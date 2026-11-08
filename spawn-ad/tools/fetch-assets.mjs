// Download the village's CC0 assets and the horse (CC BY 4.0), listed in tools/assets.json, into assets/, and
// bake the sky.
//   node tools/fetch-assets.mjs            (idempotent: files already there with the right checksum are kept,
//                                           the sky is baked again only when its settings change)
//   node tools/fetch-assets.mjs --bake-sky (bake the sky again anyway)
// Needs ffmpeg (to write the baked sky as JPEG), like the render scripts.
//
// The sky: Poly Haven's 16k HDR is decoded once and turned into
//   assets/sky/window.jpg   a native-resolution crop round the way the camera looks (45 px per degree),
//   assets/sky/pano.jpg     the whole sky at 2k, for anything outside the window,
//   assets/sky/light.hdr    the 1k HDR with the sun's disc clamped (the scene's sun light stands in for it),
//                           exposed and white-balanced like the background, for image-based lighting,
//   assets/sky/sky.json     how it was rotated and exposed, the sun's direction and colour, the sky's light as
//                           spherical harmonics (for foliage shaders) and a small table of the horizon's colours
//                           (the haze fades distant things into the sky behind them).
// Baked colours are display-linear: exposure and white balance, then a soft shoulder above 0.75 (the same curve
// the village's materials end with; below the shoulder it's linear, like the rest of the scene).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'assets');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/assets.json'), 'utf8'));
const FORCE_SKY = process.argv.includes('--bake-sky');

const log = (...a) => console.log(...a);
const rel = (f) => path.relative(ROOT, f);

// ------------------------------------------------------------------------------------------- downloads
async function getJSON(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return await r.json();
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
}

function md5File(file) {
  const h = crypto.createHash('md5');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(1 << 22);
  let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
}

/** Fetch url to file unless it's already there (with the right md5 when one is known). */
async function download(url, file, md5 = null) {
  if (fs.existsSync(file) && (!md5 || md5File(file) === md5)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.part';
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const h = crypto.createHash('md5');
      const ws = fs.createWriteStream(tmp);
      for await (const chunk of res.body) {
        h.update(chunk);
        if (!ws.write(chunk)) await new Promise((r) => ws.once('drain', r));
      }
      await new Promise((r, j) => ws.end((e) => (e ? j(e) : r())));
      if (md5 && h.digest('hex') !== md5) throw new Error('checksum mismatch');
      fs.renameSync(tmp, file);
      log('  got', rel(file));
      return true;
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

/** Run async jobs with at most n at a time. */
async function pool(jobs, n = 6) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); }
  }));
  return out;
}

async function polyhavenTexture(t) {
  const files = await getJSON(`https://api.polyhaven.com/files/${t.id}`);
  const dir = path.join(OUT, 'textures', t.id);
  const jobs = [];
  for (const [key, map] of [['Diffuse', 'diff'], ['nor_gl', 'nor_gl'], ['Rough', 'rough']]) {
    const f = files[key]?.[t.res]?.jpg;
    if (!f) throw new Error(`${t.id}: no ${key} ${t.res} jpg`);
    jobs.push(() => download(f.url, path.join(dir, `${t.id}_${map}_${t.res}.jpg`), f.md5));
  }
  return jobs;
}

async function polyhavenModel(m) {
  const files = await getJSON(`https://api.polyhaven.com/files/${m.id}`);
  const g = files.gltf?.[m.res]?.gltf;
  if (!g) throw new Error(`${m.id}: no ${m.res} gltf`);
  const dir = path.join(OUT, 'models', m.id);
  const jobs = [() => download(g.url, path.join(dir, `${m.id}_${m.res}.gltf`), g.md5)];
  for (const [p, f] of Object.entries(g.include || {})) jobs.push(() => download(f.url, path.join(dir, p), f.md5));
  return jobs;
}

/** ambientCG ships zips: fetch and unpack (stored or deflated entries; enough for their archives). */
async function ambientAtlas(a) {
  const dir = path.join(OUT, 'atlases', a.id);
  const done = path.join(dir, '.complete');
  if (fs.existsSync(done)) return;
  const zip = path.join(OUT, 'cache', `${a.id}_${a.res}.zip`);
  await download(`https://ambientcg.com/get?file=${a.id}_${a.res}.zip`, zip);
  const buf = fs.readFileSync(zip);
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error(`${a.id}: not a zip`);
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  fs.mkdirSync(dir, { recursive: true });
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${a.id}: bad zip directory`);
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/') || !/\.(jpg|png)$/i.test(name)) continue;
    const lo = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(lo, lo + csize);
    const out = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : null;
    if (!out) throw new Error(`${a.id}: unsupported zip method ${method}`);
    fs.writeFileSync(path.join(dir, path.basename(name)), out);
    log('  unpacked', rel(path.join(dir, path.basename(name))));
  }
  fs.writeFileSync(done, '');
}

// -------------------------------------------------------------------------------------------- HDR I/O
/** Radiance .hdr -> { w, h, rows(y) } where rows decodes scanline y into RGBE bytes (top row first). */
function openHDR(file) {
  const buf = fs.readFileSync(file);
  let p = 0, w = 0, h = 0;
  for (;;) {
    const e = buf.indexOf(10, p);
    const line = buf.toString('latin1', p, e);
    p = e + 1;
    const m = /^-Y (\d+) \+X (\d+)/.exec(line);
    if (m) { h = +m[1]; w = +m[2]; break; }
    if (p > 4096) throw new Error(`${file}: no resolution line`);
  }
  const row = new Uint8Array(w * 4);
  let y = 0;
  return {
    w, h,
    /** Decode the next scanline (call in order, top to bottom) into a shared RGBE buffer. */
    next() {
      if (y++ >= h) throw new Error('past the end');
      if (buf[p] === 2 && buf[p + 1] === 2 && ((buf[p + 2] << 8) | buf[p + 3]) === w) {
        p += 4;
        for (let c = 0; c < 4; c++) {
          let x = 0;
          while (x < w) {
            let n = buf[p++];
            if (n > 128) {
              n -= 128;
              const v = buf[p++];
              for (let k = 0; k < n; k++) row[(x + k) * 4 + c] = v;
            } else {
              for (let k = 0; k < n; k++) row[(x + k) * 4 + c] = buf[p + k];
              p += n;
            }
            x += n;
          }
        }
      } else {
        row.set(buf.subarray(p, p + w * 4));
        p += w * 4;
      }
      return row;
    },
  };
}

const RGBE_SCALE = new Float32Array(256).map((_, e) => (e ? Math.pow(2, e - 136) : 0));

function readHDR(file) {
  const f = openHDR(file);
  const data = new Float32Array(f.w * f.h * 3);
  for (let y = 0; y < f.h; y++) {
    const row = f.next();
    for (let x = 0; x < f.w; x++) {
      const s = RGBE_SCALE[row[x * 4 + 3]], i = (y * f.w + x) * 3;
      data[i] = row[x * 4] * s; data[i + 1] = row[x * 4 + 1] * s; data[i + 2] = row[x * 4 + 2] * s;
    }
  }
  return { w: f.w, h: f.h, data };
}

/** Float RGB -> Radiance .hdr (run-length format with literal runs only). */
function writeHDR(file, w, h, data) {
  const head = Buffer.from(`#?RADIANCE\n# baked by tools/fetch-assets.mjs\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
  const chunks = [head];
  const rgbe = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const v = Math.max(r, g, b);
      if (v < 1e-32) { rgbe.fill(0, x * 4, x * 4 + 4); continue; }
      const e = Math.ceil(Math.log2(v) + 1e-9);
      const k = 256 / Math.pow(2, e);
      rgbe[x * 4] = Math.min(255, r * k); rgbe[x * 4 + 1] = Math.min(255, g * k); rgbe[x * 4 + 2] = Math.min(255, b * k);
      rgbe[x * 4 + 3] = e + 128;
    }
    const line = [2, 2, w >> 8, w & 255];
    for (let c = 0; c < 4; c++) {
      for (let x = 0; x < w; x += 128) {
        const n = Math.min(128, w - x);
        line.push(n);
        for (let k = 0; k < n; k++) line.push(rgbe[(x + k) * 4 + c]);
      }
    }
    chunks.push(Buffer.from(line));
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}

// ------------------------------------------------------------------------------------------- the grade
// Display transform shared with the scene (src/world.js ends its materials with the same curve): linear, with a
// soft shoulder from SHOULDER up so highlights roll off instead of clipping.
const SHOULDER = 0.75;
const curve = (x) => (x < SHOULDER ? Math.max(0, x) : SHOULDER + (1 - SHOULDER) * (1 - Math.exp(-(x - SHOULDER) / (1 - SHOULDER))));
const toSRGB = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const SRGB_LUT = new Uint8Array(4097).map((_, i) => Math.round(toSRGB(i / 4096) * 255));
const byte = (lin) => SRGB_LUT[Math.round(Math.min(1, Math.max(0, lin)) * 4096)];

function encodeJPEG(file, w, h, rgb) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-',
    '-pix_fmt', 'yuvj444p', '-q:v', '1', '-frames:v', '1', file], { input: Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  log('  baked', rel(file), `${w}x${h}`);
}

/** Real spherical harmonics (order 2) of a direction. */
function shBasis(x, y, z) {
  return [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
}

async function bakeSky() {
  const S = MANIFEST.sky;
  const dir = path.join(OUT, 'sky');
  const cache = path.join(OUT, 'cache');
  const files = await getJSON(`https://api.polyhaven.com/files/${S.id}`);
  const big = files.hdri[S.background].hdr, small = files.hdri[S.lighting].hdr;
  const bigFile = path.join(cache, `${S.id}_${S.background}.hdr`), smallFile = path.join(dir, `${S.id}_${S.lighting}.hdr`);
  const settings = JSON.stringify({ id: S.id, background: S.background, lighting: S.lighting, sunAzimuth: S.sunAzimuth, window: S.window, exposure: S.exposure, whiteBalance: S.whiteBalance, sunClamp: S.sunClamp, v: 4 });
  const meta = path.join(dir, 'sky.json');
  const outs = ['window.jpg', 'pano.jpg', 'light.hdr', 'sky.json'].map((f) => path.join(dir, f));
  await download(small.url, smallFile, small.md5);
  const fresh = outs.every((f) => fs.existsSync(f)) && JSON.parse(fs.readFileSync(meta, 'utf8')).settings === settings;
  if (fresh && !FORCE_SKY) { log('sky: baked already'); return; }
  log(`sky: ${S.id} (${S.background} for the background, ${S.lighting} for the light)`);
  await download(big.url, bigFile, big.md5);

  // ---- the sun, the rotation and the exposure, from the small HDR
  const L = readHDR(smallFile);
  const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  let best = -1, bx = 0, by = 0;
  for (let y = 1; y < L.h / 2; y++) for (let x = 0; x < L.w; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += lum(L.data, ((y + dy) * L.w + ((x + dx + L.w) % L.w)) * 3);
    if (s > best) { best = s; bx = x; by = y; }
  }
  const sunU = (bx + 0.5) / L.w, sunV = 1 - (by + 0.5) / L.h; // v = 1 at the top
  const phiS = (sunU - 0.5) * 2 * Math.PI, elS = (sunV - 0.5) * Math.PI;
  const alphaS = (S.sunAzimuth * Math.PI) / 180;
  // three's equirect lookup is uv(R d) with R = rotation about y by -theta (scene.environmentRotation.y = theta);
  // theta puts the sun at azimuth alphaS (from -z towards +x)
  const theta = phiS + Math.PI / 2 - alphaS;
  const band = [];
  for (let y = 0; y < L.h; y++) {
    const el = (0.5 - (y + 0.5) / L.h) * 180;
    if (el >= 10 && el <= 40) for (let x = 0; x < L.w; x++) band.push(lum(L.data, (y * L.w + x) * 3));
  }
  band.sort((a, b) => a - b);
  const k = S.exposure / band[band.length >> 1];
  const WB = S.whiteBalance;
  log(`  sun at u ${sunU.toFixed(4)} el ${(elS * 180 / Math.PI).toFixed(2)} deg; theta ${(theta * 180 / Math.PI).toFixed(2)} deg; exposure x${k.toFixed(4)}`);

  // ---- the window (native pixels) and the 2k panorama, from the big HDR, one scanline at a time
  const B = openHDR(bigFile);
  const toRad = Math.PI / 180;
  const [az0, az1] = S.window.az.map((a) => a * toRad), [el0, el1] = S.window.el.map((a) => a * toRad);
  const uOf = (alpha) => (alpha + theta - Math.PI / 2) / (2 * Math.PI) + 0.5;
  const c0 = Math.floor(uOf(az0) * B.w), cw = Math.round(((az1 - az0) / (2 * Math.PI)) * B.w);
  const r0 = Math.ceil((0.5 - el1 / Math.PI) * B.h), r1 = Math.floor((0.5 - el0 / Math.PI) * B.h);
  const rh = r1 - r0;
  const win = new Uint8Array(cw * rh * 3);
  const winLin = new Float32Array(cw * rh * 3); // display-linear, for the haze table
  const PW = 2048, PH = 1024, f = B.w / PW;
  const pano = new Uint8Array(PW * PH * 3), acc = new Float64Array(PW * 3);
  const grade = (r, g, b, out, o) => { out[o] = curve(r * k * WB[0]); out[o + 1] = curve(g * k * WB[1]); out[o + 2] = curve(b * k * WB[2]); };
  const px = new Float32Array(3);
  for (let y = 0; y < B.h; y++) {
    const row = B.next();
    for (let x = 0; x < B.w; x++) {
      const s = RGBE_SCALE[row[x * 4 + 3]];
      const j = Math.floor(x / f) * 3;
      acc[j] += row[x * 4] * s; acc[j + 1] += row[x * 4 + 1] * s; acc[j + 2] += row[x * 4 + 2] * s;
    }
    if ((y + 1) % f === 0) {
      const py = (y + 1) / f - 1, n = f * f;
      for (let x = 0; x < PW; x++) {
        grade(acc[x * 3] / n, acc[x * 3 + 1] / n, acc[x * 3 + 2] / n, px, 0);
        const o = (py * PW + x) * 3;
        pano[o] = byte(px[0]); pano[o + 1] = byte(px[1]); pano[o + 2] = byte(px[2]);
      }
      acc.fill(0);
    }
    if (y >= r0 && y < r1) {
      const wy = y - r0;
      for (let i = 0; i < cw; i++) {
        const x = (((c0 + i) % B.w) + B.w) % B.w;
        const s = RGBE_SCALE[row[x * 4 + 3]];
        const o = (wy * cw + i) * 3;
        grade(row[x * 4] * s, row[x * 4 + 1] * s, row[x * 4 + 2] * s, winLin, o);
        win[o] = byte(winLin[o]); win[o + 1] = byte(winLin[o + 1]); win[o + 2] = byte(winLin[o + 2]);
      }
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  encodeJPEG(path.join(dir, 'window.jpg'), cw, rh, win);
  encodeJPEG(path.join(dir, 'pano.jpg'), PW, PH, pano);
  // the window's exact extent (whole pixels)
  const winAz = [((c0 / B.w - 0.5) * 2 * Math.PI + Math.PI / 2 - theta), 0];
  winAz[1] = winAz[0] + (cw / B.w) * 2 * Math.PI;
  const winEl = [(0.5 - r1 / B.h) * Math.PI, (0.5 - r0 / B.h) * Math.PI];

  // ---- haze table: the sky's colour just above the horizon (and a little higher), display-linear
  const HZ = { az: S.window.az, el: [-2, 22], w: 48, h: 24 };
  const hz = [];
  for (let j = 0; j < HZ.h; j++) {
    const el = (HZ.el[0] + ((j + 0.5) / HZ.h) * (HZ.el[1] - HZ.el[0])) * toRad;
    for (let i = 0; i < HZ.w; i++) {
      const az = (HZ.az[0] + ((i + 0.5) / HZ.w) * (HZ.az[1] - HZ.az[0])) * toRad;
      // box average over the cell (2 deg wide, 1 deg tall)
      const s = [0, 0, 0];
      let n = 0;
      for (let a = -1; a <= 1; a += 0.25) for (let e = -0.5; e <= 0.5; e += 0.25) {
        const wx = Math.round(((az + a * toRad - winAz[0]) / (winAz[1] - winAz[0])) * cw - 0.5);
        const wy = Math.round(((winEl[1] - (el + e * toRad)) / (winEl[1] - winEl[0])) * rh - 0.5);
        if (wx < 0 || wy < 0 || wx >= cw || wy >= rh) continue;
        const o = (wy * cw + wx) * 3;
        s[0] += winLin[o]; s[1] += winLin[o + 1]; s[2] += winLin[o + 2]; n++;
      }
      hz.push(...s.map((v) => +(v / Math.max(1, n)).toFixed(4)));
    }
  }

  // ---- light: the small HDR exposed and white-balanced, the sun's disc clamped; its SH and the sun's colour
  const clampL = S.sunClamp * S.exposure;
  const light = new Float32Array(L.data.length);
  const sh = Array.from({ length: 9 }, () => [0, 0, 0]);
  const sunCol = [0, 0, 0];
  let sunN = 0;
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  for (let y = 0; y < L.h; y++) {
    const el = (0.5 - (y + 0.5) / L.h) * Math.PI;
    const dOmega = ((2 * Math.PI) / L.w) * (Math.PI / L.h) * Math.cos(el);
    for (let x = 0; x < L.w; x++) {
      const i = (y * L.w + x) * 3;
      let r = L.data[i] * k * WB[0], g = L.data[i + 1] * k * WB[1], b = L.data[i + 2] * k * WB[2];
      // round the sun: its colour (from the raw HDR, before the clamp)
      if (Math.hypot(((x - bx + L.w * 1.5) % L.w) - L.w / 2, y - by) < 3) { sunCol[0] += r; sunCol[1] += g; sunCol[2] += b; sunN++; }
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > clampL) { const s = clampL / l; r *= s; g *= s; b *= s; }
      light[i] = r; light[i + 1] = g; light[i + 2] = b;
      // world direction of this texel: d = R(theta) d_r, d_r from three's equirect convention
      const phi = ((x + 0.5) / L.w - 0.5) * 2 * Math.PI;
      const xr = Math.cos(phi) * Math.cos(el), yr = Math.sin(el), zr = Math.sin(phi) * Math.cos(el);
      const xw = xr * cosT + zr * sinT, zw = -xr * sinT + zr * cosT;
      const Y = shBasis(xw, yr, zw);
      for (let c = 0; c < 9; c++) { sh[c][0] += r * Y[c] * dOmega; sh[c][1] += g * Y[c] * dOmega; sh[c][2] += b * Y[c] * dOmega; }
    }
  }
  writeHDR(path.join(dir, 'light.hdr'), L.w, L.h, light);
  log('  baked', rel(path.join(dir, 'light.hdr')));
  // irradiance SH (cosine lobe convolved): E(n) = sum A_l L_lm Y_lm(n)
  const A = [Math.PI, (2 * Math.PI) / 3, (2 * Math.PI) / 3, (2 * Math.PI) / 3, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4];
  const irr = sh.map((c, i) => c.map((v) => +(v * A[i]).toFixed(5)));
  const sunDirR = [Math.cos(phiS) * Math.cos(elS), Math.sin(elS), Math.sin(phiS) * Math.cos(elS)];
  const sunDir = [sunDirR[0] * cosT + sunDirR[2] * sinT, sunDirR[1], -sunDirR[0] * sinT + sunDirR[2] * cosT].map((v) => +v.toFixed(5));
  const sc = sunCol.map((v) => v / Math.max(1, sunN));
  const sm = Math.max(...sc);
  const out = {
    settings,
    source: { id: S.id, url: S.url, licence: S.licence },
    theta: +theta.toFixed(6),
    exposure: +k.toFixed(6),
    sun: { dir: sunDir, elevation: +((elS * 180) / Math.PI).toFixed(3), azimuth: S.sunAzimuth, color: sc.map((v) => +(v / sm).toFixed(4)) },
    window: { file: 'window.jpg', w: cw, h: rh, az: winAz.map((v) => +v.toFixed(6)), el: winEl.map((v) => +v.toFixed(6)) },
    pano: { file: 'pano.jpg', w: PW, h: PH },
    light: { file: 'light.hdr', w: L.w, h: L.h },
    sh: irr,
    haze: { ...HZ, rgb: hz },
  };
  fs.writeFileSync(meta, JSON.stringify(out));
  log('  baked', rel(meta));
}

// ------------------------------------------------------------------------------------------------ main
log(`assets -> ${rel(OUT)}/`);
const jobs = [];
for (const t of MANIFEST.textures) jobs.push(...(await polyhavenTexture(t)));
for (const m of MANIFEST.models) jobs.push(...(await polyhavenModel(m)));
const got = await pool(jobs);
log(`textures and models: ${got.filter(Boolean).length} downloaded, ${got.filter((g) => !g).length} already there`);
for (const a of MANIFEST.atlases) await ambientAtlas(a);
await bakeSky();

// ------------------------------------------------------------------------------------------- the horse
// "HORSE [DRAFT HORSE]" by BlueMesh (CC BY 4.0, credit required: tools/assets.json horse.credit), the model's
// own Sketchfab glTF export as mirrored in Objaverse. Used by src/horse.js.
{
  const h = MANIFEST.horse;
  const file = path.join(OUT, 'models/DraftHorse.glb');
  log((await download(h.download, file, h.md5)) ? 'got' : 'kept', rel(file));
}

fs.writeFileSync(path.join(OUT, 'README'), [
  'Downloaded by tools/fetch-assets.mjs from the sources listed in tools/assets.json. All CC0 1.0 (public domain),',
  `except models/DraftHorse.glb: ${MANIFEST.horse.licence}. Credit: ${MANIFEST.horse.credit}`,
  `sky: ${MANIFEST.sky.url}`,
  ...MANIFEST.textures.map((t) => `textures/${t.id}: ${t.url}`),
  ...MANIFEST.models.map((m) => `models/${m.id}: ${m.url}`),
  ...MANIFEST.atlases.map((a) => `atlases/${a.id}: ${a.url}`),
  `models/DraftHorse.glb: ${MANIFEST.horse.url}`,
  '',
].join('\n'));
log('done');
