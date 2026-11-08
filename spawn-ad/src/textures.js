// Procedural textures for the village walk (src/world.js), generated once on the CPU at startup.
// Nothing is downloaded: every map is drawn from seeded value noise or Canvas2D shapes.
//   tiling albedo + normal maps: plaster, timber, shingles, stone, planks, dirt, grass, bark
//   RGBA cards: leaves, wildflowers, banner, awning, window glass, shop signs, smoke puff
//   the sky's cloud layer: an angular map of the forward sky, lit by the low sun
import * as THREE from 'three';
import { rng, hash } from './util.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** Value noise on a 256x256 lattice, periodic so textures tile. */
export class Noise {
  constructor(seed) {
    const r = rng(seed);
    this.v = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) this.v[i] = r();
  }
  /** Noise in [0, 1) at lattice coords (x, y); repeats every (px, py) cells (powers of two <= 256). */
  n(x, y, px = 256, py = 256, ox = 0, oy = 0) {
    const xf = Math.floor(x), yf = Math.floor(y);
    let fx = x - xf, fy = y - yf;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const mx = px - 1, my = py - 1;
    const x0 = ((xf & mx) + ox) & 255, x1 = (((xf + 1) & mx) + ox) & 255;
    const y0 = (((yf & my) + oy) & 255) << 8, y1 = ((((yf + 1) & my) + oy) & 255) << 8;
    const v = this.v;
    const a = v[y0 | x0], b = v[y0 | x1], c = v[y1 | x0], d = v[y1 | x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  /** Tileable fbm in about [-1, 1] over texture coords (u, v) in [0, 1); (fu, fv) cells, powers of two. */
  fbm(u, v, fu, fv, oct = 4, gain = 0.5) {
    let s = 0, a = 1, t = 0;
    for (let i = 0; i < oct; i++) {
      s += a * (this.n(u * fu, v * fv, Math.min(fu, 256), Math.min(fv, 256), i * 53, i * 97) * 2 - 1);
      t += a; a *= gain; fu *= 2; fv *= 2;
    }
    return s / t;
  }
  /** Non-tiling fbm in lattice units. */
  fbmN(x, y, oct = 4, gain = 0.5) {
    let s = 0, a = 1, t = 0;
    for (let i = 0; i < oct; i++) {
      s += a * (this.n(x, y, 256, 256, i * 53, i * 97) * 2 - 1);
      t += a; a *= gain; x *= 2.03; y *= 2.03;
    }
    return s / t;
  }
}

// ---------------------------------------------------------------------------------------- helpers
function dataTex(data, w, h, { srgb = true, aniso = 1, wrap = true, mips = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Float sRGB (0..1) colour + optional alpha -> RGBA bytes. */
function pack(rgb, alpha, n) {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = clamp01(rgb[i * 3]) * 255 + 0.5;
    out[i * 4 + 1] = clamp01(rgb[i * 3 + 1]) * 255 + 0.5;
    out[i * 4 + 2] = clamp01(rgb[i * 3 + 2]) * 255 + 0.5;
    out[i * 4 + 3] = alpha ? clamp01(alpha[i]) * 255 + 0.5 : 255;
  }
  return out;
}

/** Tangent-space normal map from a height field in mm; texel = texel size in mm. Wraps at the edges. */
function normalFromHeight(h, w, hh, texel, gain = 1) {
  const out = new Uint8Array(w * hh * 4);
  const k = gain / (2 * texel);
  for (let y = 0; y < hh; y++) {
    const ym = ((y - 1 + hh) % hh) * w, yp = ((y + 1) % hh) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xm = x === 0 ? w - 1 : x - 1, xp = x === w - 1 ? 0 : x + 1;
      const dx = (h[yc + xp] - h[yc + xm]) * k;
      const dy = (h[yp + x] - h[ym + x]) * k;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (yc + x) * 4;
      out[i] = (-dx * il * 0.5 + 0.5) * 255 + 0.5;
      out[i + 1] = (-dy * il * 0.5 + 0.5) * 255 + 0.5;
      out[i + 2] = (il * 0.5 + 0.5) * 255 + 0.5;
      out[i + 3] = 255;
    }
  }
  return out;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

/** Canvas -> RGBA bytes with colour bled into the transparent texels (so filtering never pulls in black). */
function bleed(c, passes = 8) {
  const w = c.width, h = c.height;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let p = 0; p < passes; p++) {
    const next = filled.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (filled[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!filled[j]) continue;
        r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
      }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; next[i] = 1; }
    }
    filled = next;
  }
  // whatever is left gets the average colour
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < w * h; i++) if (filled[i]) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; }
  if (n) for (let i = 0; i < w * h; i++) if (!filled[i]) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; }
  return new Uint8Array(d.buffer.slice(0));
}

/** Random cut positions across [0, S): pieces between lo and hi texels wide; the last one closes the tile. */
function cuts(r, S, lo, hi) {
  const cs = [0];
  let x = 0;
  while (S - x > hi + lo * 0.5) { x += lo + r() * (hi - lo); cs.push(x); }
  cs.push(S);
  return cs;
}
function findCut(cs, x) {
  let k = 0;
  while (k < cs.length - 2 && cs[k + 1] <= x) k++;
  return k;
}

// ------------------------------------------------------------------------------- surface textures
/** Lime plaster, 2 m tile: soft mottling, rain streaks, patches fallen off to show the brick behind. */
function makePlaster(N) {
  const S = 512, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  const rowH = S / 30, bw = S / 9;
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const big = N.fbm(u, v, 4, 4, 3);
      const mid = N.fbm(u, v, 16, 16, 3);
      const fine = N.fbm(u, v, 128, 128, 2);
      const grit = hash(x, y + 7) - 0.5;
      const streak = sstep(0.05, 0.5, N.fbm(u, v, 16, 1, 3)) * (0.5 + 0.5 * sstep(-0.2, 0.4, N.fbm(u, v, 4, 2, 2)));
      const b = 0.88 + big * 0.08 + mid * 0.05 + fine * 0.035 + grit * 0.035;
      let R = b, G = b * 0.955, B = b * 0.875;
      const st = streak * 0.13;
      R -= st * 0.85; G -= st * 0.9; B -= st;
      let H = mid * 0.6 + fine * 0.4 + grit * 0.3;
      const pm = N.fbm(u + 0.31, v + 0.67, 4, 4, 5);
      const patch = sstep(0.27, 0.32, pm);
      if (patch > 0) {
        const row = Math.floor(y / rowH);
        const xx = (x + (row & 1) * bw * 0.5) % S;
        const bi = Math.floor(xx / bw);
        const lx = xx - bi * bw, ly = y - row * rowH;
        const mortar = Math.min(lx, bw - lx, ly, rowH - ly) < 1.7;
        const bt = hash(bi * 7 + 3, row * 13 + 1);
        let br, bg, bb, bh;
        if (mortar) { br = 0.6; bg = 0.56; bb = 0.5; bh = -8; } else {
          const k = 0.8 + bt * 0.35 + fine * 0.12;
          br = 0.6 * k; bg = 0.36 * k; bb = 0.27 * k; bh = -6.5 + fine * 0.8 + grit * 0.3;
        }
        R = mix(R, br, patch); G = mix(G, bg, patch); B = mix(B, bb, patch); H = mix(H, bh, patch);
      }
      const rim = sstep(0.2, 0.28, pm) * (1 - patch);
      R -= rim * 0.1; G -= rim * 0.1; B -= rim * 0.09;
      rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B; h[i] = H;
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S), normal: dataTex(normalFromHeight(h, S, S, 3.9, 1.2), S, S, { srgb: false }) };
}

/** Old oak beams, 1 m tile, grain along u: growth lines, fibres, cracks and grey weathering. */
function makeTimber(N) {
  const S = 512, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const rc = v * 26 + N.fbm(u, v, 2, 8, 3) * 2.4 + N.fbm(u, v, 4, 4, 2) * 1.2;
      const ring = Math.abs(Math.sin(rc * Math.PI));
      const line = 1 - sstep(0, 0.35, ring);
      const fiber = N.fbm(u, v, 8, 256, 2);
      const weather = sstep(-0.05, 0.45, N.fbm(u + 0.2, v, 2, 4, 3));
      const crack = (1 - sstep(0, 0.04, Math.abs(N.fbm(u, v + 0.13, 2, 64, 3)))) * sstep(0.05, 0.3, N.fbm(u, v, 4, 4, 2));
      const grit = hash(x + 11, y) - 0.5;
      const b = 1 + fiber * 0.14 - line * 0.24 + grit * 0.06;
      let R = 0.42 * b, G = 0.29 * b, B = 0.2 * b;
      const wk = weather * 0.5;
      R = mix(R, 0.5 * b, wk); G = mix(G, 0.45 * b, wk); B = mix(B, 0.4 * b, wk);
      const ck = 1 - crack * 0.7;
      rgb[i * 3] = R * ck; rgb[i * 3 + 1] = G * ck; rgb[i * 3 + 2] = B * ck;
      h[i] = -line * 0.7 + fiber * 0.4 - crack * 3 + grit * 0.12;
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S), normal: dataTex(normalFromHeight(h, S, S, 1.95, 1), S, S, { srgb: false }) };
}

/** Roof shingles, 2 m tile, 10 courses; v runs down the slope. Neutral so each roof can be tinted. */
function makeShingles(N) {
  const S = 512, n = S * S, rows = 10, rowH = S / rows;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  const r = rng(77);
  const R0 = [];
  for (let k = 0; k < rows; k++) R0.push({ off: r() * S, cs: cuts(r, S, 34, 82) });
  for (let y = 0; y < S; y++) {
    const v = y / S;
    const row = Math.floor(y / rowH), t = (y - row * rowH) / rowH;
    const { off, cs } = R0[row];
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const xx = (x + off) % S;
      const k = findCut(cs, xx);
      const lx = xx - cs[k], sw = cs[k + 1] - cs[k];
      const edge = Math.min(lx, sw - lx);
      const gap = 1 - sstep(0.5, 2.2, edge);
      const id = row * 64 + k;
      const tone = 0.78 + hash(id, 5) * 0.36;
      const hue = hash(id, 9) - 0.5;
      const fiber = N.fbm(u, v, 128, 8, 2);
      const moss = sstep(0.18, 0.5, N.fbm(u, v, 4, 4, 4) + (t - 0.5) * 0.2) * 0.8;
      const shade = 0.5 + 0.5 * sstep(0, 0.22, t);
      const lip = sstep(0.85, 1, t) * 0.07;
      const grit = hash(x + 3, y + 5) - 0.5;
      const b = tone * (1 + fiber * 0.12 + grit * 0.05) * shade + lip;
      let R = 0.64 * b * (1 + hue * 0.1), G = 0.59 * b, B = 0.55 * b * (1 - hue * 0.1);
      R = mix(R, 0.3 * shade, moss); G = mix(G, 0.37 * shade, moss); B = mix(B, 0.17 * shade, moss);
      const gk = 1 - gap * 0.75;
      rgb[i * 3] = R * gk; rgb[i * 3 + 1] = G * gk; rgb[i * 3 + 2] = B * gk;
      h[i] = t * 7 + fiber * 0.35 - gap * 3 + moss * 0.6;
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S), normal: dataTex(normalFromHeight(h, S, S, 3.9, 1), S, S, { srgb: false }) };
}

/** Rubble stone in rough courses, 2 m tile: domed stones, recessed mortar, mixed stone colours. */
function makeStone(N) {
  const S = 512, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  const r = rng(91);
  const rowsY = [0];
  let yy = 0;
  while (S - yy > 84) { yy += 38 + r() * 30; rowsY.push(yy); }
  rowsY.push(S);
  const rows = [];
  for (let k = 0; k < rowsY.length - 1; k++) rows.push({ off: r() * S, cs: cuts(r, S, 54, 150) });
  const pal = [[0.56, 0.55, 0.52], [0.63, 0.58, 0.49], [0.58, 0.5, 0.43], [0.5, 0.52, 0.55], [0.66, 0.63, 0.57]];
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const wx = N.fbm(u, v, 16, 16, 2) * 6, wy = N.fbm(u + 0.5, v + 0.25, 16, 16, 2) * 6;
      const X = (x + wx + S) % S, Y = (y + wy + S) % S;
      let k = 0;
      while (k < rowsY.length - 2 && rowsY[k + 1] <= Y) k++;
      const ly = Y - rowsY[k], sh = rowsY[k + 1] - rowsY[k];
      const row = rows[k];
      const xx = (X + row.off) % S;
      const j = findCut(row.cs, xx);
      const lx = xx - row.cs[j], sw = row.cs[j + 1] - row.cs[j];
      const hx = sw / 2 - 3, hy = sh / 2 - 3, rad = Math.min(14, hx, hy);
      const qx = Math.abs(lx - sw / 2) - (hx - rad), qy = Math.abs(ly - sh / 2) - (hy - rad);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      const speck = N.fbm(u, v, 64, 64, 3);
      const grit = hash(x + 1, y + 9) - 0.5;
      let R, G, B, H;
      if (d < 0) {
        const dome = sstep(0, 18, -d);
        const id = k * 97 + j;
        const c = pal[Math.floor(hash(id, 3) * pal.length)];
        const tone = 0.78 + hash(id, 4) * 0.3;
        const b = tone * (0.72 + 0.28 * dome) * (1 + speck * 0.16 + grit * 0.06);
        R = c[0] * b; G = c[1] * b; B = c[2] * b;
        H = 2 + dome * 6 + speck * 1.1 + grit * 0.2;
      } else {
        const b = 0.62 + speck * 0.1 + grit * 0.08;
        R = 0.5 * b; G = 0.47 * b; B = 0.42 * b;
        H = -1 + speck * 0.4;
      }
      rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B; h[i] = H;
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S), normal: dataTex(normalFromHeight(h, S, S, 3.9, 1), S, S, { srgb: false }) };
}

/** Boards, 2 m tile, running along u: gaps, butt joints, grain. Doors, crates, carts, fences, stalls. */
function makePlanks(N) {
  const S = 512, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  const r = rng(53);
  const bs = cuts(r, S, 44, 66);
  const joints = bs.map(() => (r() < 0.6 ? r() * S : -1));
  for (let y = 0; y < S; y++) {
    const v = y / S;
    const k = findCut(bs, y);
    const lv = y - bs[k], bw = bs[k + 1] - bs[k];
    const edge = Math.min(lv, bw - lv);
    const gap = 1 - sstep(0.6, 2, edge);
    const tone = 0.82 + hash(k, 21) * 0.3;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const rc = (lv / bw) * 6 + N.fbm(u, v, 2, 16, 3) * 1.8 + k * 0.37;
      const line = 1 - sstep(0, 0.3, Math.abs(Math.sin(rc * Math.PI)));
      const fiber = N.fbm(u, v, 8, 256, 2);
      let joint = 0;
      if (joints[k] >= 0) { const dj = Math.abs(((x - joints[k] + S * 1.5) % S) - S / 2); joint = 1 - sstep(0.5, 1.8, dj); }
      const weather = sstep(0, 0.5, N.fbm(u, v, 2, 2, 3));
      const grit = hash(x + 5, y + 1) - 0.5;
      const b = tone * (1 + fiber * 0.12 - line * 0.18 + grit * 0.05);
      let R = 0.56 * b, G = 0.41 * b, B = 0.28 * b;
      R = mix(R, 0.55 * b, weather * 0.35); G = mix(G, 0.5 * b, weather * 0.35); B = mix(B, 0.44 * b, weather * 0.35);
      const gk = (1 - gap * 0.7) * (1 - joint * 0.6);
      rgb[i * 3] = R * gk; rgb[i * 3 + 1] = G * gk; rgb[i * 3 + 2] = B * gk;
      h[i] = -gap * 3 - joint * 2 - line * 0.4 + fiber * 0.3;
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S), normal: dataTex(normalFromHeight(h, S, S, 3.9, 1), S, S, { srgb: false }) };
}

/** Trail dirt, 4 m tile: dry and damp patches, grit, pebbles with contact shadows, bits of straw. */
function makeDirt(N) {
  const S = 1024, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const m = N.fbm(u, v, 4, 4, 5);
      const mid = N.fbm(u, v, 32, 32, 3);
      const fine = N.fbm(u, v, 256, 256, 1);
      const grit = hash(x, y) - 0.5;
      const dry = sstep(-0.1, 0.4, m), damp = sstep(0.05, -0.45, m);
      let R = 0.5, G = 0.39, B = 0.28;
      R = mix(R, 0.62, dry); G = mix(G, 0.51, dry); B = mix(B, 0.38, dry);
      R = mix(R, 0.36, damp); G = mix(G, 0.27, damp); B = mix(B, 0.19, damp);
      const b = 1 + mid * 0.1 + fine * 0.07 + grit * 0.08;
      rgb[i * 3] = R * b; rgb[i * 3 + 1] = G * b; rgb[i * 3 + 2] = B * b;
      h[i] = m * 2 + mid * 1.2 + fine * 0.5 + grit * 0.35;
    }
  }
  const r = rng(404);
  // pebbles
  for (let p = 0; p < 1500; p++) {
    const cx = r() * S, cy = r() * S;
    const big = r() < 0.06;
    const rx = big ? 5 + r() * 6 : 1.3 + Math.pow(r(), 1.6) * 4.5, ry = rx * (0.6 + r() * 0.4);
    const a = r() * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    const tone = 0.36 + r() * 0.26, warm = 0.02 + r() * 0.1;
    const pr = tone + warm, pg = tone + warm * 0.4, pb = tone - warm * 0.3;
    const ext = Math.ceil(rx * 1.9) + 1;
    for (let dy = -ext; dy <= ext; dy++) for (let dx = -ext; dx <= ext; dx++) {
      const px = ((Math.floor(cx) + dx) % S + S) % S, py = ((Math.floor(cy) + dy) % S + S) % S;
      const fx = Math.floor(cx) + dx - cx, fy = Math.floor(cy) + dy - cy;
      const lx = (fx * ca + fy * sa) / rx, ly = (-fx * sa + fy * ca) / ry;
      const e = lx * lx + ly * ly;
      const i = py * S + px;
      if (e < 1) {
        const dome = Math.sqrt(1 - e);
        const sh = 0.8 + 0.25 * dome - 0.12 * (lx + ly) * 0.5;
        rgb[i * 3] = pr * sh; rgb[i * 3 + 1] = pg * sh; rgb[i * 3 + 2] = pb * sh;
        h[i] = Math.max(h[i], dome * rx * 1.6 + 1);
      } else if (e < 2.6) {
        const k = 0.72 + 0.28 * sstep(1, 2.6, e);
        rgb[i * 3] *= k; rgb[i * 3 + 1] *= k; rgb[i * 3 + 2] *= k;
      }
    }
  }
  // straw and twigs
  for (let p = 0; p < 260; p++) {
    let x = r() * S, y = r() * S;
    const a = r() * Math.PI * 2, len = 8 + r() * 22;
    const c = r() < 0.7 ? [0.72, 0.62, 0.42] : [0.36, 0.27, 0.2];
    for (let s = 0; s < len; s++) {
      const i = ((Math.floor(y) % S + S) % S) * S + ((Math.floor(x) % S + S) % S);
      rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
      h[i] += 0.6;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S, { aniso: 2 }), normal: dataTex(normalFromHeight(h, S, S, 3.9, 0.9), S, S, { srgb: false, aniso: 2 }) };
}

/** Lawn seen from above, 2 m tile: thousands of short blades over dark soil, clover and dry patches. */
function makeGrassGround(N) {
  const S = 512, n = S * S;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const m = N.fbm(u, v, 8, 8, 3);
      const b = 0.8 + m * 0.2;
      rgb[i * 3] = 0.15 * b; rgb[i * 3 + 1] = 0.21 * b; rgb[i * 3 + 2] = 0.08 * b;
      h[i] = m * 0.5;
    }
  }
  const r = rng(808);
  const greens = [[0.3, 0.45, 0.14], [0.36, 0.52, 0.17], [0.26, 0.4, 0.13], [0.45, 0.55, 0.2], [0.52, 0.55, 0.25], [0.22, 0.34, 0.1]];
  for (let p = 0; p < 16000; p++) {
    let x = r() * S, y = r() * S;
    const a = r() * Math.PI * 2, len = 4 + r() * 9;
    const u = x / S, v = y / S;
    const dryness = sstep(0.1, 0.5, N.fbm(u, v, 4, 4, 3));
    const c = greens[Math.floor(r() * greens.length)];
    const tone = 0.8 + r() * 0.4;
    const cr = mix(c[0], 0.62, dryness * 0.6) * tone, cg = mix(c[1], 0.55, dryness * 0.5) * tone, cb = mix(c[2], 0.28, dryness * 0.5) * tone;
    for (let s = 0; s < len; s++) {
      const k = s / len;
      const i = ((Math.floor(y) % S + S) % S) * S + ((Math.floor(x) % S + S) % S);
      const lt = 0.7 + 0.45 * k;
      rgb[i * 3] = cr * lt; rgb[i * 3 + 1] = cg * lt; rgb[i * 3 + 2] = cb * lt;
      h[i] = 1 + k * 1.5;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  return { map: dataTex(pack(rgb, null, n), S, S, { aniso: 2 }), normal: dataTex(normalFromHeight(h, S, S, 3.9, 0.6), S, S, { srgb: false, aniso: 2 }) };
}

/** Bark, 2 m tile: deep furrows along v, plates, a little lichen. */
function makeBark(N) {
  const W = 512, H = 512, n = W * H;
  const rgb = new Float32Array(n * 3), h = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W, i = y * W + x;
      const warp = N.fbm(u, v, 8, 2, 2) * 0.04;
      const fur = Math.abs(N.fbm(u + warp, v, 32, 2, 3));
      const ridge = sstep(0.02, 0.22, fur);
      const plate = N.fbm(u, v, 16, 8, 3);
      const lichen = sstep(0.25, 0.5, N.fbm(u + 0.4, v, 16, 8, 4));
      const grit = hash(x + 2, y + 4) - 0.5;
      const b = (0.45 + 0.55 * ridge) * (1 + plate * 0.15 + grit * 0.08);
      let R = 0.4 * b, G = 0.34 * b, B = 0.28 * b;
      R = mix(R, 0.46, lichen * 0.5); G = mix(G, 0.5, lichen * 0.5); B = mix(B, 0.38, lichen * 0.5);
      rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B;
      h[i] = ridge * 6 + plate * 1.5 + grit * 0.3;
    }
  }
  return { map: dataTex(pack(rgb, null, n), W, H), normal: dataTex(normalFromHeight(h, W, H, 3.9, 1), W, H, { srgb: false }) };
}

// -------------------------------------------------------------------------------------- RGBA cards
/** A cluster of leaves on twigs, darker inside, for alpha-tested canopy cards. */
function makeLeaves(seed, palette) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const r = rng(seed);
  const cx = S / 2, cy = S / 2;
  ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2;
    ctx.strokeStyle = '#4a3b2c';
    ctx.lineWidth = 3 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 40);
    ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * 110, cy + Math.sin(a + 0.4) * 110, cx + Math.cos(a) * 210, cy + Math.sin(a) * 210);
    ctx.stroke();
  }
  const layers = [[palette.back, 90], [palette.mid, 100], [palette.front, 90]];
  layers.forEach(([pal, count], li) => {
    for (let k = 0; k < count; k++) {
      const a = r() * Math.PI * 2;
      const rr = 225 * Math.sqrt(r()) * (li === 0 ? 0.85 : 1);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      const L = 34 + r() * 30, w = L * (0.42 + r() * 0.14);
      const dir = a + (r() - 0.5) * 1.4;
      const col = pal[Math.floor(r() * pal.length)];
      const yellow = r() < 0.08;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir);
      const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, shade(yellow ? [0.55, 0.55, 0.18] : col, 0.75));
      g.addColorStop(1, shade(yellow ? [0.7, 0.68, 0.25] : col, 1.18));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(L * 0.42, -w * 0.78, L, 0);
      ctx.quadraticCurveTo(L * 0.42, w * 0.78, 0, 0);
      ctx.fill();
      ctx.strokeStyle = `rgba(230,240,190,${0.18 + li * 0.08})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(L * 0.9, 0); ctx.stroke();
      ctx.restore();
    }
  });
  return dataTex(bleed(c), S, S, { aniso: 1 });
}
function shade(c, k) {
  return `rgb(${Math.round(clamp01(c[0] * k) * 255)},${Math.round(clamp01(c[1] * k) * 255)},${Math.round(clamp01(c[2] * k) * 255)})`;
}

/** Grass clumps seen from the side, for far cards: 2 rows (lush green, golden-dry). Blades darker at the root. */
function makeGrassCards() {
  const W = 512, H = 512, RH = 256;
  const { c, ctx } = canvas(W, H);
  const r = rng(616);
  ctx.lineCap = 'round';
  for (let row = 0; row < 2; row++) {
    const oy = row * RH;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, oy, W, RH); ctx.clip();
    const n = 230;
    for (let k = 0; k < n; k++) {
      const x0 = 8 + r() * (W - 16), h = (0.35 + Math.pow(r(), 0.8) * 0.6) * (RH - 14);
      const lean = (r() - 0.5) * 0.9, w = 3 + r() * 4.5;
      const hue = row === 0 ? 0.24 + r() * 0.06 : 0.15 + r() * 0.06;
      const lit = 0.24 + r() * 0.16 + (k / n) * 0.1;
      const g = ctx.createLinearGradient(0, oy + RH, 0, oy + RH - h);
      g.addColorStop(0, `hsl(${hue * 360},${row ? 40 : 55}%,${lit * 40}%)`);
      g.addColorStop(1, `hsl(${(hue - 0.02) * 360},${row ? 50 : 60}%,${lit * 100 + 12}%)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, oy + RH);
      ctx.quadraticCurveTo(x0 + lean * h * 0.3, oy + RH - h * 0.6, x0 + lean * h * 0.75, oy + RH - h);
      ctx.stroke();
    }
    ctx.restore();
  }
  return dataTex(bleed(c), W, H, { aniso: 1, wrap: false });
}

/** Wildflower clumps, side view, 2x2 atlas: daisies, buttercups, lavender spikes, poppies. */
function makeFlowers() {
  const S = 512, C = 256;
  const { c, ctx } = canvas(S, S);
  const r = rng(515);
  const kinds = ['daisy', 'buttercup', 'lavender', 'poppy'];
  kinds.forEach((kind, k) => {
    const ox = (k % 2) * C, oy = Math.floor(k / 2) * C;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, C, C); ctx.clip();
    // leaves at the base
    for (let i = 0; i < 16; i++) {
      const x = ox + 30 + r() * (C - 60), h = 40 + r() * 70;
      ctx.strokeStyle = shade([0.22 + r() * 0.1, 0.4 + r() * 0.12, 0.14], 1);
      ctx.lineWidth = 3 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x, oy + C); ctx.quadraticCurveTo(x + (r() - 0.5) * 50, oy + C - h * 0.6, x + (r() - 0.5) * 60, oy + C - h); ctx.stroke();
    }
    const heads = kind === 'lavender' ? 9 : 7;
    for (let i = 0; i < heads; i++) {
      const x0 = ox + 24 + r() * (C - 48), top = oy + 30 + r() * 90;
      const x1 = x0 + (r() - 0.5) * 40;
      ctx.strokeStyle = '#3f6a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x0, oy + C); ctx.quadraticCurveTo(x0, top + 60, x1, top); ctx.stroke();
      if (kind === 'lavender') {
        for (let s = 0; s < 9; s++) {
          ctx.fillStyle = shade([0.62 + r() * 0.1, 0.44 + r() * 0.08, 0.74], 0.85 + s * 0.03);
          ctx.beginPath(); ctx.ellipse(x1 + (r() - 0.5) * 3, top + 4 + s * 7, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const rad = kind === 'daisy' ? 16 : kind === 'poppy' ? 17 : 12;
        const petal = kind === 'daisy' ? [0.97, 0.96, 0.92] : kind === 'poppy' ? [0.9, 0.22, 0.12] : [1.0, 0.82, 0.18];
        const n = kind === 'daisy' ? 12 : kind === 'poppy' ? 5 : 5;
        // seen from the side and a little above: a squashed disc
        ctx.save();
        ctx.translate(x1, top);
        ctx.scale(1, 0.55);
        for (let p = 0; p < n; p++) {
          const a = (p / n) * Math.PI * 2 + r() * 0.2;
          ctx.fillStyle = shade(petal, 0.85 + r() * 0.2);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55, rad * 0.55, rad * (kind === 'daisy' ? 0.2 : 0.42), a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = kind === 'poppy' ? '#2a1a14' : '#e8b020';
        ctx.beginPath(); ctx.arc(0, 0, rad * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  });
  return dataTex(bleed(c), S, S, { aniso: 1, wrap: false });
}

/** Banner cloth: teal field, peach stripe, gold trim, a simple star, swallowtail cut (alpha). */
function makeBanner(N) {
  const W = 256, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#1d96a0';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W / 2, H * 0.84); ctx.lineTo(0, H); ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(0, H * 0.6, W, H * 0.07);
  ctx.strokeStyle = '#e8b866';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, -10, W - 16, H + 20);
  // a four-point star
  ctx.fillStyle = '#ffd9a0';
  ctx.translate(W / 2, H * 0.3);
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 16 : 54;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // woven texture
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const k = 0.9 + 0.08 * ((x + y) % 2) + N.fbm(x / W, y / H, 8, 16, 2) * 0.1;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
  return dataTex(bleed(c), W, H, { aniso: 1, wrap: false });
}

/** Striped awning cloth with a scalloped hem (alpha). */
function makeAwning() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const n = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(S, S * 0.86);
  for (let k = n - 1; k >= 0; k--) ctx.arc((k + 0.5) * S / n, S * 0.86, S / n / 2, 0, Math.PI, false);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = k % 2 ? '#efe4cc' : '#b8432f';
    ctx.fillRect(k * S / n, 0, S / n + 1, S);
  }
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.restore();
  return dataTex(bleed(c), S, S, { aniso: 1, wrap: false });
}

/** Small-paned window glass: warm glow (scaled by vertex colour when lit), dark lead cames. */
function makeWindow(N) {
  const S = 256;
  const rgb = new Float32Array(S * S * 3);
  const cols = 3, rows = 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    const cu = (u * cols) % 1, cv = (v * rows) % 1;
    const lead = Math.min(cu, 1 - cu) * S / cols < 3.2 || Math.min(cv, 1 - cv) * S / rows < 3.2;
    const frame = Math.min(u, 1 - u, v, 1 - v) * S < 9;
    // glow: brightest low in the middle (a lamp inside), bullseye ripples
    const glow = 0.55 + 0.45 * Math.exp(-((u - 0.5) ** 2 * 5 + (v - 0.62) ** 2 * 4));
    const ripple = 0.92 + 0.08 * N.fbm(u, v, 16, 16, 2);
    let R = glow * ripple, G = glow * 0.86 * ripple, B = glow * 0.66 * ripple;
    if (lead || frame) { R = 0.06; G = 0.05; B = 0.045; }
    rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B;
  }
  return dataTex(pack(rgb, null, S * S), S, S, { aniso: 1, wrap: false });
}

/** Hanging shop signs, 2x2 atlas on board: a mug, an anvil, a loaf, a potion. */
function makeSigns(N) {
  const W = 512, H = 256, CW = 256, CH = 128;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const g = N.fbm(x / W, y / H, 2, 32, 3);
    const b = 0.8 + g * 0.2;
    d[i] = 120 * b; d[i + 1] = 84 * b; d[i + 2] = 56 * b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const paint = '#f1e2c0';
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * CW, oy = Math.floor(k / 2) * CH;
    ctx.save();
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 8; ctx.strokeRect(ox + 4, oy + 4, CW - 8, CH - 8);
    ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 2.5; ctx.strokeRect(ox + 13, oy + 13, CW - 26, CH - 26);
    ctx.translate(ox + CW / 2, oy + CH / 2);
    ctx.fillStyle = paint; ctx.strokeStyle = paint; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    if (k === 0) { // mug
      ctx.fillRect(-24, -30, 40, 58);
      ctx.beginPath(); ctx.arc(20, -2, 14, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4, -32, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
    } else if (k === 1) { // anvil
      ctx.beginPath(); ctx.moveTo(-48, -22); ctx.lineTo(40, -22); ctx.quadraticCurveTo(52, -20, 56, -12); ctx.lineTo(18, -6); ctx.lineTo(12, 12);
      ctx.lineTo(28, 26); ctx.lineTo(-30, 26); ctx.lineTo(-14, 12); ctx.lineTo(-20, -6); ctx.lineTo(-48, -10); ctx.closePath(); ctx.fill();
    } else if (k === 2) { // loaf
      ctx.beginPath(); ctx.ellipse(0, 4, 50, 26, 0, Math.PI, 0); ctx.lineTo(50, 18); ctx.lineTo(-50, 18); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7a5436'; ctx.lineWidth = 4;
      for (const sx of [-24, 0, 24]) { ctx.beginPath(); ctx.moveTo(sx - 8, -10); ctx.lineTo(sx + 8, -2); ctx.stroke(); }
    } else { // potion
      ctx.beginPath(); ctx.arc(0, 10, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-9, -34, 18, 26); ctx.fillRect(-13, -42, 26, 9);
    }
    ctx.restore();
  }
  return dataTex(bleed(c), W, H, { aniso: 1, wrap: false });
}

/** Tileable noise for shaders: R = broad fbm, G = finer fbm, B = per-texel grain (linear data). */
function makeNoiseTex(N) {
  const S = 256, n = S * S;
  const out = new Uint8Array(n * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    out[i] = clamp01(0.5 + N.fbm(u + 0.13, v + 0.71, 4, 4, 4) * 0.9) * 255;
    out[i + 1] = clamp01(0.5 + N.fbm(u + 0.57, v + 0.29, 16, 16, 3) * 0.9) * 255;
    out[i + 2] = hash(x + 77, y + 33) * 255;
    out[i + 3] = 255;
  }
  return dataTex(out, S, S, { srgb: false, aniso: 1 });
}

/** Radial glow sprite (white, alpha falls off smoothly). */
function makeGlow() {
  const S = 128, n = S * S;
  const rgb = new Float32Array(n * 3).fill(1), a = new Float32Array(n);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S - 0.5, v = (y + 0.5) / S - 0.5;
    const r2 = (u * u + v * v) * 4;
    a[y * S + x] = Math.max(0, Math.exp(-r2 * 4.5) - Math.exp(-4.5)) / (1 - Math.exp(-4.5));
  }
  return dataTex(pack(rgb, a, n), S, S, { aniso: 1, wrap: false, srgb: false });
}

/** 4x4 white (albedo) and flat (normal) maps, so untextured surfaces can share the textured program. */
function makeFlat() {
  const w = new Uint8Array(64).fill(255), nm = new Uint8Array(64);
  for (let i = 0; i < 16; i++) nm.set([128, 128, 255, 255], i * 4);
  return { map: dataTex(w, 4, 4, { mips: false }), normal: dataTex(nm, 4, 4, { srgb: false, mips: false }) };
}

/** Soft smoke puff. */
function makeSmoke(N) {
  const S = 128;
  const rgb = new Float32Array(S * S * 3), a = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S - 0.5, v = y / S - 0.5, i = y * S + x;
    const rr = Math.sqrt(u * u + v * v) * 2;
    const nn = N.fbm(x / S, y / S, 4, 4, 4);
    const k = clamp01(1 - rr * (1.05 - nn * 0.35));
    a[i] = k * k * (3 - 2 * k) * (0.75 + nn * 0.5);
    const b = 0.85 + nn * 0.15;
    rgb[i * 3] = b; rgb[i * 3 + 1] = b; rgb[i * 3 + 2] = b;
  }
  return dataTex(pack(rgb, a, S * S), S, S, { aniso: 1, wrap: false });
}

// -------------------------------------------------------------------------------------- the sky
/**
 * The cloud layer: an angular map of the forward sky. u: azimuth -45..45 deg (0 = straight ahead, -z;
 * negative = left), v: elevation 42 deg (top row) .. -3 deg. A bank of heaped clouds on the horizon,
 * lit from the low sun; mid-level clouds on a plane above, their undersides warm; high wisps.
 * RGB is the cloud's colour (sRGB), A its coverage.
 */
export const CLOUD_MAP = { az0: -45, az1: 45, el0: 42, el1: -3 };
function makeClouds(sunAz, sunEl) {
  const W = 1536, H = 768, n = W * H;
  const N = new Noise(911);
  const { az0, az1, el0, el1 } = CLOUD_MAP;
  const D2R = Math.PI / 180;
  const dens = new Float32Array(n), mid = new Float32Array(n);
  // pass 1: density, in angular space, squashed toward the horizon for foreshortening
  for (let y = 0; y < H; y++) {
    const el = el0 + (el1 - el0) * (y + 0.5) / H;
    if (el < 0.3) continue;
    const sq = 1 + 3.2 * Math.exp(-el / 7);
    for (let x = 0; x < W; x++) {
      const az = az0 + (az1 - az0) * (x + 0.5) / W;
      const i = y * W + x;
      // stratocumulus: stretched along the horizon, warped, with billowy edges
      const bx = az / 12, by = el * sq / 3.4;
      const wx = N.fbmN(bx * 0.5 + 3.3, by * 0.5 + 7.1, 3) * 1.1, wy = N.fbmN(bx * 0.5 + 9.7, by * 0.5 + 1.9, 3) * 0.45;
      const mass = N.fbmN(bx + wx + 11.5, by + wy + 5.2, 5);
      const billow = Math.abs(N.fbmN(az / 2.8 + 2.4, el * sq / 1.3 + 8.8, 4));
      // fewer clouds low in the middle (keep the castle clear) and overhead
      const clearLow = Math.exp(-Math.pow((el - 6) / 6, 2)) * Math.exp(-Math.pow((az - 4) / 16, 2));
      const gaps = N.fbmN(az / 11 + 31.7, el / 9 + 4.3, 2) * 0.42;
      const cover = -0.04 + 0.14 * sstep(18, 42, el) + 0.5 * clearLow + gaps;
      const d = sstep(cover, cover + 0.34, mass + (billow - 0.3) * 0.16) * sstep(0.8, 4, el);
      // high wisps
      const hx = az / 26, hy = el * sq / 1.3;
      const sw = N.fbmN(hx * 2 + 4.4, hy * 0.3 + 2.2, 2) * 0.8;
      const streak = Math.pow(clamp01(1 - Math.abs(N.fbmN(hx + 6.1, hy + sw + 3.3, 4)) * 3.2), 2);
      const wisp = streak * sstep(0.0, 0.3, N.fbmN(az / 30 + 1.1, el / 10 + 8.4, 2)) * 0.45 * sstep(6, 14, el);
      mid[i] = d;
      dens[i] = Math.max(d, wisp);
    }
  }
  // pass 2: shade. Edges facing the sun are lit gold-peach, edges away from it dusty mauve, thick cores
  // a deeper rose; thin edges near the sun glow.
  const sx = (sunAz - az0) / (az1 - az0) * W, sy = (el0 - sunEl) / (el0 - el1) * H;
  const rgb = new Float32Array(n * 3), alpha = new Float32Array(n);
  const at = (x, y) => dens[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const G = 7;
  for (let y = 0; y < H; y++) {
    const el = el0 + (el1 - el0) * (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d0 = dens[i];
      if (d0 < 0.003) continue;
      const az = az0 + (az1 - az0) * (x + 0.5) / W;
      const dSun = Math.hypot((az - sunAz) * Math.cos(el * D2R), el - sunEl);
      const near = Math.exp(-dSun / 24), core = Math.exp(-dSun / 8);
      // direction toward the sun in map space and the density gradient
      let tx = sx - x, ty = sy - y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const gx = at(x + G, y) - at(x - G, y), gy = at(x, y + G) - at(x, y - G);
      const gl = Math.hypot(gx, gy);
      const facing = gl > 1e-4 ? -(gx * tx + gy * ty) / gl : 0;
      const edge = Math.min(1, gl * 2.2);
      const side = clamp01(0.55 + 0.55 * facing * edge);
      const thick = sstep(0.55, 1, mid[i]) * (1 - edge);
      const litR = mix(0.99, 1.0, near), litG = mix(0.77, 0.87, near), litB = mix(0.76, 0.66, near);
      const shR = 0.86, shG = 0.71, shB = 0.79;
      const k = clamp01(0.3 + side * 0.75 * (0.85 + 0.3 * near) - thick * 0.2);
      let R = mix(shR, litR, k), Gc = mix(shG, litG, k), B = mix(shB, litB, k);
      const tex = 0.94 + N.fbmN(az / 1.5 + 5.5, el / 0.8 + 1.7, 3) * 0.12;
      R *= tex; Gc *= tex; B *= tex;
      const rim = (1 - d0) * core * 0.8;
      R += rim; Gc += rim * 0.85; B += rim * 0.6;
      const hz = 1 - sstep(0.5, 6, el);
      R = mix(R, 1.0, hz * 0.6); Gc = mix(Gc, 0.85, hz * 0.6); B = mix(B, 0.72, hz * 0.6);
      let A = clamp01(d0 * 0.92) * (1 - hz * 0.5);
      const u = x / W;
      A *= sstep(0, 0.07, u) * sstep(1, 0.93, u);
      rgb[i * 3] = R; rgb[i * 3 + 1] = Gc; rgb[i * 3 + 2] = B; alpha[i] = A;
    }
  }
  return dataTex(pack(rgb, alpha, n), W, H, { aniso: 1, wrap: false });
}

// -------------------------------------------------------------------------------------- all of it
export function makeTextures({ sunAz, sunEl }) {
  const N = new Noise(1234);
  const leafPal = {
    back: [[0.12, 0.2, 0.07], [0.1, 0.17, 0.06], [0.14, 0.22, 0.08]],
    mid: [[0.2, 0.32, 0.1], [0.24, 0.36, 0.11], [0.18, 0.3, 0.09]],
    front: [[0.32, 0.46, 0.14], [0.38, 0.5, 0.16], [0.28, 0.42, 0.12], [0.44, 0.52, 0.18]],
  };
  const hedgePal = {
    back: [[0.08, 0.15, 0.06], [0.1, 0.17, 0.07]],
    mid: [[0.16, 0.27, 0.1], [0.19, 0.3, 0.11]],
    front: [[0.26, 0.4, 0.14], [0.3, 0.44, 0.15], [0.36, 0.47, 0.17]],
  };
  return {
    plaster: makePlaster(N),
    timber: makeTimber(N),
    shingles: makeShingles(N),
    stone: makeStone(N),
    planks: makePlanks(N),
    dirt: makeDirt(N),
    grass: makeGrassGround(N),
    bark: makeBark(N),
    leaves: makeLeaves(4242, leafPal),
    hedge: makeLeaves(777, hedgePal),
    flowers: makeFlowers(),
    grassCards: makeGrassCards(),
    banner: makeBanner(N),
    awning: makeAwning(),
    window: makeWindow(N),
    signs: makeSigns(N),
    smoke: makeSmoke(N),
    noise: makeNoiseTex(N),
    flat: makeFlat(),
    glow: makeGlow(),
    clouds: makeClouds(sunAz, sunEl),
  };
}
