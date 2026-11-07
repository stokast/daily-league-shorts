// Render chosen moments to PNG (and optionally a contact sheet) for review.
// node render/stills.mjs <times comma list> <outDir> [scale=0.5] [sheet.png] [cols=4]
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serve, BROWSER_ARGS } from './server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const [, , timesArg, outDir = 'scratch/stills', scaleArg = '0.5', sheet, colsArg = '4', extraQuery = ''] = process.argv;
const scale = +scaleArg;
const W = Math.round(1080 * scale / 2) * 2, H = Math.round(1920 * scale / 2) * 2;
const times = timesArg.split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const root = new URL('..', import.meta.url).pathname;
const files = [];
const server = await serve(root, {
  onFrame: (i, buf) => {
    const t = times[i];
    const file = path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', file], { input: buf });
    if (r.status) throw new Error(r.stderr.toString());
    files[i] = file;
  },
});
const browser = await chromium.launch({ args: BROWSER_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const base = `http://127.0.0.1:${server.address().port}`;
await page.goto(`${base}/index.html?w=${W}&h=${H}${extraQuery ? '&' + extraQuery : ''}`);
await page.waitForFunction('window.ready===true', null, { timeout: 120000 });
const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  await page.evaluate(async ([t, i, url]) => {
    const px = window.ad.grab(t);
    await fetch(`${url}?i=${i}`, { method: 'POST', body: px });
  }, [times[i], i, `${base}/frame`]);
}
console.log(`rendered ${times.length} stills at ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
server.close();
if (sheet) {
  const cols = +colsArg;
  const rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap((f) => ['-i', f]);
  const pads = files.length < rows * cols ? rows * cols - files.length : 0;
  const tw = Math.round(W / 2), th = Math.round(H / 2);
  let filter = files.map((_, i) => `[${i}:v]scale=${tw}:${th},drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='${times[i].toFixed(2)}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
  for (let k = 0; k < pads; k++) filter += `;color=c=black:s=${tw}x${th}:d=1[p${k}]`;
  const labels = files.map((_, i) => `[v${i}]`).concat(Array.from({ length: pads }, (_, k) => `[p${k}]`));
  const layout = labels.map((_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`).join('|');
  filter += `;${labels.join('')}xstack=inputs=${labels.length}:layout=${layout}[out]`;
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', sheet]);
  if (r.status) console.log(r.stderr.toString()); else console.log('sheet', sheet);
}
