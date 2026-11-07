// Render the ad to video.
// node render/render.mjs [--w 1080] [--h 1920] [--fps 30] [--from 0] [--to <last frame+1>] [--jobs 1]
//                        [--out build/video.mp4] [--crf 17] [--preset slow] [--audio build/audio.wav]
// Each job renders a contiguous range in its own headless Chromium and encodes a near-lossless
// segment; segments are then joined and encoded once (with the audio, if given).
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serve, BROWSER_ARGS } from './server.mjs';
import { DURATION, FPS } from '../src/timeline.js';
const { chromium } = createRequire(import.meta.url)('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const W = +(args.w || 1080), H = +(args.h || 1920);
const fps = +(args.fps || FPS);
const from = +(args.from || 0);
const to = +(args.to || Math.round(DURATION * fps));
const jobs = +(args.jobs || 1);
const out = args.out || 'build/video.mp4';
const crf = args.crf || '17';
const preset = args.preset || 'slow';
const root = new URL('..', import.meta.url).pathname;
const tmp = path.join(root, 'build', 'segments');
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

async function renderSegment(k, a, b) {
  const seg = path.join(tmp, `seg_${String(k).padStart(2, '0')}.mkv`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv444p', '-c:v', 'libx264', '-preset', 'veryfast', '-qp', '4',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  let done = 0;
  const t0 = Date.now();
  const server = await serve(root, {
    onFrame: (i, buf) => new Promise((resolve, reject) => {
      if (buf.length !== W * H * 4) { reject(new Error(`bad frame size ${buf.length}`)); return; }
      done++;
      if (done % 15 === 0 || i === b - 1) {
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(`[job ${k}] frame ${i + 1}/${b} (${done}/${b - a}) ${(el / done).toFixed(2)} s/frame, eta ${((b - a - done) * el / done / 60).toFixed(1)} min\n`);
      }
      if (!ff.stdin.write(buf)) ff.stdin.once('drain', resolve); else resolve();
    }),
  });
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log(`[job ${k}] pageerror:`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('failed')) console.log(`[job ${k}] console:`, m.text()); });
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/index.html?w=${W}&h=${H}`);
  await page.waitForFunction('window.ready===true', null, { timeout: 180000 });
  await page.evaluate(([a, b, url]) => window.ad.renderRange(a, b, 1, url), [a, b, `${base}/frame`]);
  await browser.close();
  server.close();
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  return seg;
}

const t0 = Date.now();
const per = Math.ceil((to - from) / jobs);
const ranges = Array.from({ length: jobs }, (_, k) => [from + k * per, Math.min(to, from + (k + 1) * per)]).filter(([a, b]) => b > a);
const segs = await Promise.all(ranges.map(([a, b], k) => renderSegment(k, a, b)));
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
const enc = ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
if (args.audio) enc.push('-itsoffset', String(from / fps), '-i', args.audio);
enc.push('-map', '0:v');
if (args.audio) enc.push('-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
enc.push('-vf', 'scale=in_color_matrix=bt709:out_color_matrix=bt709:in_range=tv:out_range=tv,format=yuv420p');
enc.push('-c:v', 'libx264', '-preset', preset, '-crf', crf, '-profile:v', 'high', '-tune', 'film',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out);
const r = spawnSync('ffmpeg', enc, { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`wrote ${out} (${to - from} frames) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
