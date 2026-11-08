// Pack a project into a self-contained render page: everything the project loads (found by running it once in
// a headless browser), the render runtime, the soundtrack already encoded as AAC, and a manifest. The result is
// a folder of static files meant to be published as a private claude.ai artifact (see README.md), where the
// viewer renders the video on their own GPU and saves an MP4 without installing anything.
//
// This runs on the machine that builds the project (a cloud session), never on the viewer's computer.
//   node gpu-render/pack.mjs <project dir> [--page index.html] [--query "w=1080&h=1920"] [--name spawn-ad]
//        [--title "Spawn Ad Render"] [--audio build/audio.wav] [--priming 1024] [--bitrate 40000000]
//        [--samples 12] [--test-seconds 3] [--out gpu-render/dist/<name>] [--keep-css]
// Needs Playwright's Chromium and ffmpeg (for the soundtrack) where it runs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const LIMITS = { file: 15 * 1024 * 1024, text: 16 * 1024 * 1024, batch: 60 * 1024 * 1024, batchFiles: 250, total: 256 * 1024 * 1024, files: 511 };
const TEXT = new Set(['.js', '.mjs', '.css', '.json', '.html', '.htm', '.txt', '.svg', '.glsl', '.md', '.csv']);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.aac': 'audio/aac',
};

// ------------------------------------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const opt = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes(`--${name}`);
const projectDir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--keep-css'].includes(argv[i - 1])));
if (!projectDir) {
  console.error('usage: node gpu-render/pack.mjs <project dir> [--page index.html] [--audio file] [--name name] ...');
  process.exit(2);
}
const ROOT = path.resolve(projectDir);
const PAGE = opt('page', 'index.html');
const QUERY = opt('query', '');
const NAME = opt('name', path.basename(ROOT));
const TITLE = opt('title', `${NAME.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Render`);
const OUT = path.resolve(opt('out', path.join(HERE, 'dist', NAME)));
const AUDIO = opt('audio');
const PRIMING = +opt('priming', 1024);
const BITRATE = opt('bitrate') ? +opt('bitrate') : null;
const SAMPLES = +opt('samples', 12);
const TEST_SECONDS = +opt('test-seconds', 3);

// ------------------------------------------------------------------------------------------------ helpers
function serve(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function loadPlaywright() {
  for (const from of [import.meta.url, path.join(process.cwd(), 'x.js'), '/opt/node-tools/x.js']) {
    try { return createRequire(from)('playwright'); } catch { /* next */ }
  }
  throw new Error('Playwright is needed to pack (it runs the project once to see what it loads)');
}

const BROWSER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'];

/** Same discovery as the runtime: window.gpuRender, or window.ad + window.ready. */
const FIND_TARGET = `(() => {
  const g = window.gpuRender;
  if (g && g.canvas && typeof g.draw === 'function' && g.ready !== false) return { width: g.width || g.canvas.width, height: g.height || g.canvas.height, fps: g.fps, duration: g.duration, kind: 'gpuRender' };
  const ad = window.ad;
  if (window.ready === true && ad && typeof ad.render === 'function') return { width: ad.W, height: ad.H, fps: ad.fps, duration: ad.duration, kind: 'ad' };
  return null;
})()`;
const DRAW = `(t) => { const g = window.gpuRender; return g && typeof g.draw === 'function' ? g.draw(t) : window.ad.render(t); }`;

const rel = (fromDir, toPath) => {
  let r = path.posix.relative(fromDir, toPath);
  if (!r.startsWith('.')) r = './' + r;
  return r;
};

/** Root-relative URLs ('/assets/x') would point outside the artifact: make them relative. */
function rewrite(text, fileRel, tops) {
  if (!tops.length) return text;
  const dir = path.posix.dirname('/' + fileRel);
  const T = tops.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const ext = path.extname(fileRel).toLowerCase();
  if (ext === '.css') {
    return text.replace(new RegExp(`url\\((['"]?)\\/((?:${T})(?:\\/[^)'"]*)?)\\1\\)`, 'g'), (m, q, p) => `url(${q}${rel(dir, '/' + p)}${q})`);
  }
  if (ext === '.js' || ext === '.mjs') {
    // module specifiers resolve against the module itself
    text = text.replace(new RegExp(`(\\b(?:from|import)\\s*\\(?\\s*)(['"])\\/((?:${T})\\/[^'"]+)\\2`, 'g'), (m, pre, q, p) => `${pre}${q}${rel(dir, '/' + p)}${q}`);
  }
  // everything else (fetch, loaders, image URLs, import map entries) resolves against the page at the bundle root
  return text.replace(new RegExp(`(['"\`])\\/((?:${T})(?=[/'"\`])[^'"\`]*)`, 'g'), (m, q, p) => `${q}./${p}`);
}

function readScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) scripts.push({ attrs: m[1], body: m[2] });
  return scripts;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------------------------------------ 1. run it
console.log(`packing ${ROOT} (${PAGE}) -> ${OUT}`);
const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: BROWSER_ARGS });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const seen = new Map(); // url -> status
const external = new Set();
let lastRequest = Date.now();
page.on('request', (r) => { lastRequest = Date.now(); });
page.on('response', (r) => {
  const u = r.url();
  if (u.startsWith(base)) seen.set(u.split('?')[0].split('#')[0], r.status());
  else if (!u.startsWith('data:') && !u.startsWith('blob:')) external.add(u);
});
page.on('pageerror', (e) => console.log('  page error:', e.message));
await page.goto(`${base}/${PAGE}${QUERY ? '?' + QUERY : ''}`);
let target = null;
for (let i = 0; i < 1800 && !target; i++) {
  target = await page.evaluate(FIND_TARGET);
  if (!target) await new Promise((r) => setTimeout(r, 100));
}
if (!target) throw new Error('the project never became ready: expose window.gpuRender (see README.md)');
console.log(`  ready: ${target.width}x${target.height} @ ${target.fps} fps, ${target.duration} s (${target.kind})`);
// step through the timeline so anything loaded on demand is fetched too
for (let k = 0; k < SAMPLES; k++) {
  const t = ((k + 0.5) / SAMPLES) * target.duration;
  await page.evaluate(`(${DRAW})(${t})`);
}
while (Date.now() - lastRequest < 1500) await new Promise((r) => setTimeout(r, 250));
await browser.close();
server.close();

// ------------------------------------------------------------------------------------------------ 2. copy
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const files = [];
for (const [u, status] of seen) {
  if (status !== 200) continue;
  const p = decodeURIComponent(new URL(u).pathname).replace(/^\//, '');
  if (!p || p === PAGE) continue;
  const src = path.join(ROOT, p);
  if (!fs.existsSync(src) || fs.statSync(src).isDirectory()) continue;
  files.push(p);
}
const tops = [...new Set(files.map((p) => p.split('/')[0]))];
for (const p of files) {
  const src = path.join(ROOT, p), dst = path.join(OUT, p);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (TEXT.has(path.extname(p).toLowerCase())) fs.writeFileSync(dst, rewrite(fs.readFileSync(src, 'utf8'), p, tops));
  else fs.copyFileSync(src, dst);
}

// the runtime
fs.mkdirSync(path.join(OUT, 'gpu-render'), { recursive: true });
for (const f of ['harness.js', 'mp4.js', 'adts.js', 'shim.js']) fs.copyFileSync(path.join(HERE, 'runtime', f), path.join(OUT, 'gpu-render', f));

// the soundtrack, encoded here (browsers can't all encode AAC; every one can copy it into the MP4)
let audioInfo = null;
if (AUDIO) {
  const dst = path.join(OUT, 'gpu-render', 'audio.aac');
  if (AUDIO.toLowerCase().endsWith('.aac')) fs.copyFileSync(AUDIO, dst);
  else {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', AUDIO, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-f', 'adts', dst]);
    if (r.status) throw new Error(`ffmpeg could not encode the soundtrack: ${r.stderr}`);
  }
  audioInfo = 'AAC 48 kHz stereo, 256 kbit/s';
}

// ------------------------------------------------------------------------------------------------ 3. the page
const projectHtml = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
const scripts = readScripts(projectHtml);
const importMaps = scripts.filter((s) => /type\s*=\s*["']?importmap/i.test(s.attrs)).map((s) => rewrite(s.body, PAGE, tops).replace(/(["'])\/((?:[^"'/]+)\/)/g, (m, q, p) => (tops.includes(p.slice(0, -1)) ? `${q}./${p}` : m)));
const projectScripts = scripts.filter((s) => !/type\s*=\s*["']?importmap/i.test(s.attrs)).map((s) => {
  const attrs = s.attrs.replace(/\bsrc\s*=\s*(["'])\/([^"']+)\1/i, (m, q, p) => `src=${q}./${p}${q}`);
  return `<script${attrs}>${s.body ? rewrite(s.body, PAGE, tops) : ''}</script>`;
});
const keptCss = flag('keep-css') ? [...projectHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') : '';
const W = target.width, H = target.height, FPS = target.fps, DUR = target.duration;
const frames = Math.round(DUR * FPS);
const setQuery = QUERY ? `<script>try { history.replaceState(null, '', location.pathname + '?${QUERY.replace(/[^\w=&.%-]/g, '')}' + location.hash); } catch (e) {}</script>\n` : '';

const PAGE_HTML = `<title>${esc(TITLE)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: the preview on the left at the video's own shape, the controls in a column on the right; one column on phones. */
:root {
  --bg: #eceef1; --panel: #fbfbfc; --ink: #16191e; --muted: #5b6370; --line: #d5d9df; --accent: #2b59c3;
  --accent-ink: #ffffff; --good: #1e7a46; --bad: #b3352a; --busy: #8a5d00; --stage: #0c0d10;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #101216; --panel: #171a1f; --ink: #e7e9ed; --muted: #9aa2ae; --line: #2a2f37; --accent: #7b9ef0;
    --accent-ink: #0d1117; --good: #5cc48a; --bad: #f08a7e; --busy: #e0b45c; --stage: #050506; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #101216; --panel: #171a1f; --ink: #e7e9ed; --muted: #9aa2ae; --line: #2a2f37; --accent: #7b9ef0;
  --accent-ink: #0d1117; --good: #5cc48a; --bad: #f08a7e; --busy: #e0b45c; --stage: #050506; color-scheme: dark;
}
body {
  background: var(--bg); color: var(--ink); font: 15px/1.5 var(--sans);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 24px;
}
body > canvas { position: fixed; left: -100000px; top: 0; width: 1px !important; height: 1px !important; }
.gr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 23rem); gap: 28px; max-width: 66rem; margin: 0 auto; align-items: start; }
@media (max-width: 760px) { .gr { grid-template-columns: minmax(0, 1fr); } }
.gr-stage {
  background: var(--stage); border-radius: 8px; overflow: hidden; width: 100%; max-width: calc(80vh * ${W} / ${H});
  aspect-ratio: ${W} / ${H}; margin-inline: auto; display: grid; place-items: center;
}
.gr-stage canvas.gr-canvas { width: 100% !important; height: 100% !important; display: block; }
.gr-wait { color: #8b93a1; font-size: 13px; padding: 16px; text-align: center; }
.gr-panel { display: grid; gap: 14px; min-width: 0; }
.gr-eyebrow { margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.gr-panel h1 { margin: 0; font-size: 26px; line-height: 1.15; text-wrap: balance; }
.gr-status { margin: 0; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.gr-status::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex: none; }
.gr-status[data-tone="good"]::before { background: var(--good); }
.gr-status[data-tone="bad"] { color: var(--bad); }
.gr-status[data-tone="bad"]::before { background: var(--bad); }
.gr-status[data-tone="busy"]::before { background: var(--busy); animation: gr-pulse 1s ease-in-out infinite alternate; }
@keyframes gr-pulse { from { opacity: 1; } to { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .gr-status[data-tone="busy"]::before { animation: none; } }
.gr-detail, .gr-progress, .gr-note { margin: 0; color: var(--muted); font-size: 13px; }
.gr-progress { font-variant-numeric: tabular-nums; min-height: 1.5em; }
.gr-specs { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 14px; padding: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
.gr-specs dt { color: var(--muted); font-size: 13px; }
.gr-specs dd { margin: 0; font: 13px/1.5 var(--mono); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.gr-actions { display: flex; flex-wrap: wrap; gap: 10px; }
button { font: 600 14px/1 var(--sans); padding: 11px 16px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
button:disabled { opacity: 0.45; cursor: default; }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
progress { width: 100%; height: 8px; accent-color: var(--accent); }
.gr-result { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.gr-result p { margin: 0; font: 13px/1.4 var(--mono); flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; }
${keptCss}
</style>
<main class="gr">
  <section class="gr-stage" id="gr-stage" aria-label="Preview"><p class="gr-wait">The preview appears once the project has loaded.</p></section>
  <section class="gr-panel">
    <p class="gr-eyebrow">GPU render</p>
    <h1>${esc(TITLE.replace(/\s+Render$/, ''))}</h1>
    <p id="gr-status" class="gr-status" data-tone="busy">Loading the project…</p>
    <p id="gr-detail" class="gr-detail">Starting</p>
    <dl class="gr-specs">
      <dt>Video</dt><dd>${W} × ${H}, ${FPS} fps, ${DUR} s (${frames} frames)</dd>
      <dt>Sound</dt><dd>${esc(audioInfo || 'none')}</dd>
      <dt>Graphics</dt><dd id="gr-gpu">checking</dd>
      <dt>Encoder</dt><dd id="gr-encoder">checking</dd>
    </dl>
    <div class="gr-actions">
      <button id="gr-render" class="primary" type="button" disabled>Render video</button>
      <button id="gr-test" type="button" disabled>Test the first ${TEST_SECONDS} s</button>
      <button id="gr-cancel" type="button" hidden>Stop</button>
    </div>
    <progress id="gr-bar" max="1" value="0" hidden></progress>
    <p id="gr-progress" class="gr-progress"></p>
    <div id="gr-result" class="gr-result" hidden>
      <p id="gr-result-text"></p>
      <button id="gr-save" class="primary" type="button">Save video</button>
    </div>
    <p id="gr-note" class="gr-note">Everything runs in this browser tab: nothing is installed on your computer. Keep the tab in front while it renders.</p>
  </section>
</main>
${setQuery}${importMaps.map((m) => `<script type="importmap">${m}</script>`).join('\n')}
<script type="module" src="./gpu-render/shim.js"></script>
${projectScripts.join('\n')}
<script type="module" src="./gpu-render/harness.js"></script>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), PAGE_HTML);

const manifest = {
  name: NAME, title: TITLE, output: `${NAME}.mp4`, width: W, height: H, fps: FPS, duration: DUR, frames,
  bitrate: BITRATE, audio: AUDIO ? 'gpu-render/audio.aac' : null, audioPriming: PRIMING, audioBitrate: 256000,
  testSeconds: TEST_SECONDS, packedFrom: path.basename(ROOT), packedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, 'gpu-render', 'manifest.json'), JSON.stringify(manifest, null, 2));

// ------------------------------------------------------------------------------------------------ 4. publish plan
const all = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else all.push({ path: path.relative(OUT, p).split(path.sep).join('/'), size: fs.statSync(p).size });
  }
};
walk(OUT);
const problems = [];
for (const f of all) {
  const limit = TEXT.has(path.extname(f.path).toLowerCase()) ? LIMITS.text : LIMITS.file;
  if (f.size > limit) problems.push(`${f.path} is ${(f.size / 1048576).toFixed(1)} MB (an artifact file can be at most ${limit / 1048576} MB)`);
}
const total = all.reduce((s, f) => s + f.size, 0);
if (total > LIMITS.total) problems.push(`the bundle is ${(total / 1048576).toFixed(0)} MB (an artifact version can hold ${LIMITS.total / 1048576} MB)`);
if (all.length > LIMITS.files) problems.push(`the bundle has ${all.length} files (an artifact version can hold ${LIMITS.files})`);
const batches = [];
let cur = [], curSize = 0;
for (const f of all.filter((f) => f.path !== 'index.html').sort((a, b) => a.path.localeCompare(b.path))) {
  if (cur.length && (curSize + f.size > LIMITS.batch || cur.length >= LIMITS.batchFiles)) { batches.push(cur); cur = []; curSize = 0; }
  cur.push(f.path); curSize += f.size;
}
if (cur.length) batches.push(cur);
fs.writeFileSync(path.join(OUT, 'publish.json'), JSON.stringify({ page: 'index.html', title: TITLE, capabilities: { downloads: true }, batches, files: all.length, bytes: total }, null, 2));

console.log(`  ${files.length} project files (${tops.join(', ')}), ${all.length} in the bundle, ${(total / 1048576).toFixed(1)} MB, ${batches.length} publish batch(es)`);
if (external.size) console.log(`  not bundled (loaded from other hosts, which an artifact blocks unless it's an allowed CDN script):\n    ${[...external].join('\n    ')}`);
for (const p of problems) console.log(`  PROBLEM: ${p}`);
console.log(`  wrote ${path.relative(process.cwd(), OUT)}/index.html and publish.json`);
