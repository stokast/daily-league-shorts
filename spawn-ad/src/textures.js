// Small textures for the village (src/world.js), made once at startup. The surfaces themselves are real PBR
// scans (src/assets.js); what's drawn here are the alpha cards and painted bits:
//   leaf clusters composited from ambientCG's scanned leaves, wild grass and flower cards, the banner and
//   awning cloth, window glass, shop signs, a soft glow, smoke, water ripples and a noise texture for shaders.
import * as THREE from 'three';
import { rng, hash } from './util.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

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
}

// ---------------------------------------------------------------------------------------- helpers
function dataTex(data, w, h, { srgb = true, aniso = 1, wrap = true, wrapT = wrap, mips = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = wrapT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
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
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < w * h; i++) if (filled[i]) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; }
  if (n) for (let i = 0; i < w * h; i++) if (!filled[i]) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; }
  return new Uint8Array(d.buffer.slice(0));
}
function shade(c, k) {
  return `rgb(${Math.round(clamp01(c[0] * k) * 255)},${Math.round(clamp01(c[1] * k) * 255)},${Math.round(clamp01(c[2] * k) * 255)})`;
}

// -------------------------------------------------------------------------------------- leaf clusters
/**
 * Leaf-cluster cards from real scanned leaves (ambientCG LeafSet024: nine leaves on black + an opacity map):
 * a 2x2 atlas of different clusters, each a spray of twigs under three layers of leaves, darker and denser at
 * the back, sunnier at the front. `tones` shifts the greens (trees vs hedges).
 */
function makeLeafAtlas(colorImg, opacityImg, seed, tones) {
  // the scan as one RGBA image, and each leaf's box
  const S = colorImg.width;
  const src = canvas(S, S), op = canvas(S, S);
  src.ctx.drawImage(colorImg, 0, 0, S, S);
  op.ctx.drawImage(opacityImg, 0, 0, S, S);
  const sd = src.ctx.getImageData(0, 0, S, S), od = op.ctx.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) sd.data[i * 4 + 3] = od[i * 4];
  src.ctx.putImageData(sd, 0, 0);
  const leaves = [];
  const cell = S / 3;
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
    let x0 = S, y0 = S, x1 = 0, y1 = 0;
    for (let y = Math.floor(gy * cell); y < Math.floor((gy + 1) * cell); y += 2) for (let x = Math.floor(gx * cell); x < Math.floor((gx + 1) * cell); x += 2) {
      if (od[(y * S + x) * 4] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    if (x1 > x0 + 8 && y1 > y0 + 8) leaves.push({ x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 });
  }
  const A = 1024, C = 512;
  const { c, ctx } = canvas(A, A);
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * C, oy = Math.floor(k / 2) * C;
    const cx = ox + C / 2, cy = oy + C / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, C, C); ctx.clip();
    for (let t = 0; t < 7; t++) {
      const a = r() * Math.PI * 2;
      ctx.strokeStyle = '#4a3b2c';
      ctx.lineWidth = 3 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 40);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * 110, cy + Math.sin(a + 0.4) * 110, cx + Math.cos(a) * 205, cy + Math.sin(a) * 205);
      ctx.stroke();
    }
    for (const [filter, count, reach] of tones) {
      ctx.filter = filter;
      for (let n = 0; n < count; n++) {
        const lf = leaves[Math.floor(r() * leaves.length)];
        const a = r() * Math.PI * 2;
        const rr = 222 * Math.sqrt(r()) * reach;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const len = 58 + r() * 34; // leaf length in px
        const s = len / Math.max(lf.w, lf.h);
        ctx.save();
        ctx.translate(x, y);
        // leaves point outwards (the scans have the tip up)
        ctx.rotate(a + Math.PI / 2 + (r() - 0.5) * 1.3);
        ctx.scale(s * (r() < 0.5 ? -1 : 1), s);
        ctx.drawImage(src.c, lf.x, lf.y, lf.w, lf.h, -lf.w / 2, -lf.h * 0.9, lf.w, lf.h);
        ctx.restore();
      }
    }
    ctx.filter = 'none';
    ctx.restore();
  }
  return dataTex(bleed(c, 6), A, A, { aniso: 1, wrap: false });
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
        const n = kind === 'daisy' ? 12 : 5;
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

/** Banner cloth: teal field, peach stripe, gold trim, a four-point star, swallowtail cut (alpha). */
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
  ctx.fillStyle = '#ffd9a0';
  ctx.translate(W / 2, H * 0.3);
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 16 : 54;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const k = 0.9 + 0.08 * ((x + y) % 2) + N.fbm(x / W, y / H, 8, 16, 2) * 0.1;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
  return dataTex(bleed(c), W, H, { aniso: 1, wrap: false });
}

/**
 * Striped awning cloth with a scalloped hem (alpha), four colourways stacked in rows of 128 px:
 * red/cream, teal/peach (on brand), saffron/cream, blue/white. u repeats along the awning.
 */
function makeAwning(N) {
  const W = 256, RH = 128;
  const { c, ctx } = canvas(W, RH * 4);
  const ways = [['#b8432f', '#f1e6cc'], ['#1d96a0', '#ffd9a0'], ['#d8962a', '#f6ecd2'], ['#3c5c9c', '#f2f0ea']];
  const n = 4; // stripe pairs across one repeat
  ways.forEach(([a, b], row) => {
    const oy = row * RH;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.lineTo(W, oy + RH * 0.84);
    const sc = 2 * n;
    for (let k = sc - 1; k >= 0; k--) ctx.arc((k + 0.5) * W / sc, oy + RH * 0.84, W / sc / 2, 0, Math.PI, false);
    ctx.closePath();
    ctx.clip();
    for (let k = 0; k < 2 * n; k++) {
      ctx.fillStyle = k % 2 ? b : a;
      ctx.fillRect(k * W / (2 * n), oy, W / (2 * n) + 1, RH);
    }
    const g = ctx.createLinearGradient(0, oy, 0, oy + RH);
    g.addColorStop(0, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = g; ctx.fillRect(0, oy, W, RH);
    ctx.restore();
  });
  const img = ctx.getImageData(0, 0, W, RH * 4), d = img.data;
  for (let y = 0; y < RH * 4; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const k = 0.93 + 0.05 * ((x + y) % 2) + N.fbm(x / W, y / (RH * 4), 8, 32, 2) * 0.06;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
  return dataTex(bleed(c), W, RH * 4, { aniso: 1, wrap: true, wrapT: false });
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
  const ink = '#f1e2c0';
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * CW, oy = Math.floor(k / 2) * CH;
    ctx.save();
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 8; ctx.strokeRect(ox + 4, oy + 4, CW - 8, CH - 8);
    ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 2.5; ctx.strokeRect(ox + 13, oy + 13, CW - 26, CH - 26);
    ctx.translate(ox + CW / 2, oy + CH / 2);
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.lineJoin = 'round';
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

/** Gentle ripples as a tangent-space normal map (tiles), for the stream. */
function makeRipples(N) {
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = N.fbm(x / S, y / S, 8, 4, 4) * 0.7 + N.fbm(x / S + 0.3, y / S, 32, 16, 2) * 0.3;
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)]) * 6;
    const dy = (h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]) * 6;
    const l = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    const i = (y * S + x) * 4;
    out[i] = (-dx * l * 0.5 + 0.5) * 255; out[i + 1] = (-dy * l * 0.5 + 0.5) * 255; out[i + 2] = (l * 0.5 + 0.5) * 255; out[i + 3] = 255;
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

// -------------------------------------------------------------------------------------- all of it
/** leafScan: { color, opacity } images of ambientCG LeafSet024. */
export function makeTextures(leafScan) {
  const N = new Noise(1234);
  return {
    // trees: sunny greens; hedges: deeper
    leaves: makeLeafAtlas(leafScan.color, leafScan.opacity, 4242, [
      ['brightness(0.42) saturate(1.0)', 70, 0.8], ['brightness(0.64) saturate(1.05)', 80, 0.95], ['brightness(0.86) saturate(1.1) hue-rotate(-5deg)', 70, 1],
    ]),
    hedge: makeLeafAtlas(leafScan.color, leafScan.opacity, 777, [
      ['brightness(0.36) saturate(1.0)', 80, 0.85], ['brightness(0.55) saturate(1.05)', 80, 0.95], ['brightness(0.74) saturate(1.1)', 60, 1],
    ]),
    flowers: makeFlowers(),
    grassCards: makeGrassCards(),
    banner: makeBanner(N),
    awning: makeAwning(N),
    window: makeWindow(N),
    signs: makeSigns(N),
    smoke: makeSmoke(N),
    noise: makeNoiseTex(N),
    ripples: makeRipples(N),
    flat: makeFlat(),
    glow: makeGlow(),
  };
}
