// End-to-end check of the GPU render tool, run where the tool is built (it needs Playwright's Chromium, ffmpeg
// and ffprobe there; none of it is needed by whoever renders).
//   node gpu-render/test/e2e.mjs                       pack the demo with a click track, render it, and check the
//                                                      MP4: every frame present and in order, sound in sync
//   node gpu-render/test/e2e.mjs --bundle <dir> --seconds 2 [--from 8] [--out file.mp4]
//                                                      test-render the first seconds of any packed bundle
// The headless browser here has no GPU and encodes in software: it checks the pipeline, not the speed.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TOOL = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const BROWSER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'];

function loadPlaywright() {
  for (const from of [import.meta.url, path.join(process.cwd(), 'x.js'), '/opt/node-tools/x.js']) {
    try { return createRequire(from)('playwright'); } catch { /* next */ }
  }
  throw new Error('Playwright is needed for this test');
}
function serve(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 30, ...opts });
  if (r.status) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
};

/** Open a packed bundle, render `seconds` (null: all), save the MP4 to `out`. */
async function renderBundle(dir, seconds, out, startAt = 0) {
  const server = await serve(dir);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => ['ready', 'error'].includes(window.gpuRenderState?.phase), null, { timeout: 600000 });
  const status = await page.textContent('#gr-status');
  if ((await page.evaluate(() => window.gpuRenderState.phase)) === 'error') throw new Error(`page error: ${status} ${errors.join(' | ')}`);
  const encoder = await page.textContent('#gr-encoder');
  const t0 = Date.now();
  await page.evaluate(([s, a]) => window.gpuRenderStart(s, a), [seconds, startAt]);
  await page.waitForFunction(() => window.gpuRenderState.phase !== 'rendering', null, { timeout: 3600000 });
  const phase = await page.evaluate(() => window.gpuRenderState.phase);
  if (phase !== 'done') throw new Error(`render did not finish: ${await page.textContent('#gr-status')} ${errors.join(' | ')}`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#gr-save')]);
  await download.saveAs(out);
  const progress = await page.textContent('#gr-progress');
  await browser.close();
  server.close();
  return { encoder, progress, seconds: (Date.now() - t0) / 1000, errors };
}

function probe(file) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', file]).toString());
}

// ------------------------------------------------------------------------------------------------ any bundle
if (opt('bundle')) {
  const out = path.resolve(opt('out', path.join(os.tmpdir(), 'gpu-render-test.mp4')));
  const r = await renderBundle(path.resolve(opt('bundle')), +opt('seconds', 2), out, +opt('from', 0));
  const p = probe(out);
  console.log(`encoder: ${r.encoder}\n${r.progress}\nsaved ${out}`);
  for (const s of p.streams) console.log(`  ${s.codec_type}: ${s.codec_name} ${s.width ? `${s.width}x${s.height} ${s.r_frame_rate} ${s.nb_read_frames} frames` : `${s.sample_rate} Hz ${s.channels} ch`} ${s.duration} s`);
  run('ffmpeg', ['-v', 'error', '-xerror', '-i', out, '-f', 'null', '-']);
  console.log('  decodes cleanly');
  if (r.errors.length) console.log('  page errors:', r.errors.join(' | '));
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------ the demo
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gpu-render-e2e-'));
const SR = 48000, DUR = 4;
// a click track: a 10 ms 1 kHz burst on every whole second, the same moments the demo flashes white
{
  const n = SR * DUR;
  const pcm = Buffer.alloc(44 + n * 4);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = t - Math.floor(t);
    const v = f < 0.01 ? Math.round(Math.sin(2 * Math.PI * 1000 * t) * 20000) : 0;
    pcm.writeInt16LE(v, 44 + i * 4); pcm.writeInt16LE(v, 46 + i * 4);
  }
  fs.writeFileSync(path.join(work, 'clicks.wav'), pcm);
}
const dist = path.join(work, 'dist');
console.log('packing the demo');
run('node', [path.join(TOOL, 'pack.mjs'), path.join(TOOL, 'demo'), '--name', 'demo', '--audio', path.join(work, 'clicks.wav'), '--samples', '4', '--test-seconds', '2', '--out', dist], { stdio: 'inherit' });

let failures = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

for (const [label, seconds] of [['full', null], ['test (2 s)', 2]]) {
  console.log(`rendering: ${label}`);
  const out = path.join(work, `demo-${seconds || 'full'}.mp4`);
  const r = await renderBundle(dist, seconds, out);
  console.log(`  encoder: ${r.encoder}; ${r.progress}`);
  const want = seconds || DUR;
  const p = probe(out);
  const v = p.streams.find((s) => s.codec_type === 'video'), a = p.streams.find((s) => s.codec_type === 'audio');
  check(v && v.codec_name === 'h264' && v.width === 540 && v.height === 960, `video: ${v && `${v.codec_name} ${v.width}x${v.height}`}`);
  check(v && +v.nb_read_frames === want * 30 && v.r_frame_rate === '30/1', `frames: ${v && v.nb_read_frames} at ${v && v.r_frame_rate} (want ${want * 30})`);
  check(a && a.codec_name === 'aac' && +a.sample_rate === SR && a.channels === 2, `audio: ${a && `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch`}`);
  check(Math.abs(+p.format.duration - want) < 0.03, `duration: ${p.format.duration} s (want ${want})`);
  check(spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', out, '-f', 'null', '-']).status === 0, 'decodes without errors');
  // every frame, in order: read the barcode
  const gray = run('ffmpeg', ['-v', 'error', '-i', out, '-vf', 'scale=540:960', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const frameBytes = 540 * 960;
  const frames = gray.length / frameBytes;
  const idx = [], flashes = [];
  for (let f = 0; f < frames; f++) {
    let n = 0;
    for (let b = 0; b < 10; b++) {
      const x = Math.round((b + 0.5) * 54), y = 960 - 30;
      n = (n << 1) | (gray[f * frameBytes + y * 540 + x] > 128 ? 1 : 0);
    }
    idx.push(n);
    if (gray[f * frameBytes + 300 * 540 + 270] > 240 && gray[f * frameBytes + 600 * 540 + 100] > 240) flashes.push(f);
  }
  check(idx.every((n, i) => n === i), `barcodes read 0..${frames - 1} in order${idx.every((n, i) => n === i) ? '' : `: ${idx.slice(0, 40).join(',')}`}`);
  // sound in sync: clicks against flashes
  const pcm = run('ffmpeg', ['-v', 'error', '-i', out, '-ac', '1', '-f', 'f32le', '-ar', String(SR), '-']);
  const s = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  const clicks = [];
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > 0.2 && (!clicks.length || i - clicks[clicks.length - 1] > SR * 0.5)) clicks.push(i);
  // (a clip that ends on a whole second still carries that click in its last AAC frame, past the end)
  const clickT = clicks.map((i) => i / SR).filter((ct) => ct < want - 0.03), flashT = flashes.map((f) => f / 30);
  const pairs = flashT.map((ft) => Math.min(...clickT.map((ct) => Math.abs(ct - ft))));
  const worst = Math.max(...pairs) * 1000;
  check(flashT.length === want && clickT.length === want && worst < 2, `sync: ${flashT.length} flashes, ${clickT.length} clicks, worst offset ${worst.toFixed(1)} ms`);
}
console.log(failures ? `${failures} check(s) failed (files in ${work})` : 'all checks passed');
if (!failures && !argv.includes('--keep')) fs.rmSync(work, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
