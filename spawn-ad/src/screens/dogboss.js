// BISCUIT: FINAL BOSS (made-up game). A retro pixel-art boss intro: a giant corgi boss on a throne.
// Every sprite is drawn procedurally into small indexed-colour buffers on a 240x180 art grid, then
// scaled up with nearest-neighbour sampling so the pixels stay crisp at any canvas size.
import * as K from './kit.js';

export const meta = { id: 'dogboss', title: 'BISCUIT: FINAL BOSS', aspect: 4 / 3 };

const LW = 240, LH = 180;

// ---------------------------------------------------------------- palette (index 0 = transparent)
const COL = {
  void: '#06041a', ink: '#140a1e',
  mortar: '#0f0c2c', wallD: '#1a1645', wall: '#251f5c', wallL: '#312a76', wallH: '#41398f',
  stD: '#221f4c', st: '#332f6c', stL: '#47428f', stH: '#6560b8',
  flD: '#110e2a', fl: '#1b173f', flL: '#262052',
  cpD: '#4f0b1f', cp: '#86152e', cpL: '#b8283c',
  goldD: '#9c5f17', gold: '#e2a531', goldL: '#ffe28a',
  vlD: '#2a1150', vl: '#45207a', vlL: '#6532a3', vlH: '#8a4fd0',
  o0: '#3d140e', o1: '#7e3015', o2: '#bd561f', o3: '#e9842f', o4: '#ffad55', o5: '#ffd796',
  w0: '#5e5487', w1: '#9c90bf', w2: '#d3c9e3', w3: '#f5eee6', w4: '#ffffff',
  pk1: '#a9466a', pk2: '#e9879f',
  nose: '#120914', noseH: '#6a5a78',
  eye0: '#e0261a', eye1: '#ff8d24', eye2: '#ffe766', eye3: '#fffbe0',
  sR: '#e23a4c', sB: '#3d6bdc', sG: '#3fbf6a', sY: '#f2c63a',
  hS: '#e3e8f4', hM: '#a2aacb', hD: '#5d6592', hR: '#ec4150', hRD: '#9e1d36',
  hB: '#3e74e8', hBD: '#24439c', hBt: '#5b3727', hV: '#0c0a1e',
  f0: '#c92f18', f1: '#ff7c1c', f2: '#ffca3c', f3: '#fff5c4',
  uiK: '#09061c', uiW: '#f5eee6', uiG: '#8d84b3',
  hpE: '#2c0b22', hp0: '#8a1230', hp1: '#d8283f', hp2: '#ff5b66', hp3: '#ffb0b5',
};
const NAMES = Object.keys(COL);
const C = {};
NAMES.forEach((n, i) => { C[n] = i + 1; });
const RGB = [[0, 0, 0, 0], ...NAMES.map((n) => { const v = parseInt(COL[n].slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255, 255]; })];
const ci = (c) => (typeof c === 'string' ? C[c] : c);

// light ramps (dark -> light) for dithered lighting passes
const RAMPS = [
  ['void', 'mortar', 'wallD', 'wall', 'wallL', 'wallH'],
  ['void', 'stD', 'st', 'stL', 'stH'],
  ['void', 'flD', 'fl', 'flL', 'stL'],
  ['void', 'cpD', 'cp', 'cpL', 'hp2'],
  ['void', 'vlD', 'vl', 'vlL', 'vlH'],
  ['o0', 'goldD', 'gold', 'goldL'],
];
const UP = new Uint8Array(256), DOWN = new Uint8Array(256);
for (let i = 0; i < 256; i++) { UP[i] = i; DOWN[i] = i; }
for (const r of RAMPS) {
  for (let i = 0; i < r.length; i++) {
    if (i + 1 < r.length) UP[C[r[i]]] = C[r[i + 1]];
    if (i > 0) DOWN[C[r[i]]] = C[r[i - 1]];
  }
}
UP[C.void] = C.mortar; DOWN[C.void] = C.void;

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// ---------------------------------------------------------------- tiny indexed pixel engine
const buf = (w, h) => ({ w, h, d: new Uint8Array(w * h) });
const gp = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : b.d[y * b.w + x]);
const sp = (b, x, y, c) => { if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.d[y * b.w + x] = c; };

/** Pen: paints colour c; `only` limits it to pixels currently holding one of the listed colours. */
function pen(b, c, only) {
  const k = ci(c);
  if (only == null) return (x, y) => sp(b, x, y, k);
  if (only === 'filled') return (x, y) => { if (gp(b, x, y)) sp(b, x, y, k); };
  if (only === 'empty') return (x, y) => { if (!gp(b, x, y)) sp(b, x, y, k); };
  const set = new Set((Array.isArray(only) ? only : [only]).map(ci));
  return (x, y) => { if (set.has(gp(b, x, y))) sp(b, x, y, k); };
}
const inE = (x, y, cx, cy, rx, ry) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; };
function ell(cx, cy, rx, ry, p) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) if (inE(x, y, cx, cy, rx, ry)) p(x, y);
  }
}
function poly(pts, p) {
  let y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) p(x, y);
    }
  }
}
function rect(x, y, w, h, p) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) p(i, j); }
function line(x0, y0, x1, y1, p) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    p(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
/** Shape list -> pen. Shapes: ['e', cx, cy, rx, ry] or ['p', [[x, y], ...]] or ['r', x, y, w, h]. */
function shape(sh, p, ox = 0, oy = 0) {
  if (sh[0] === 'e') ell(sh[1] + ox, sh[2] + oy, sh[3], sh[4], p);
  else if (sh[0] === 'p') poly(sh[1].map(([x, y]) => [x + ox, y + oy]), p);
  else rect(sh[1] + ox, sh[2] + oy, sh[3], sh[4], p);
}
/**
 * A group of shapes filled as one blob with a 1px outline around the union, then shaded by
 * offsetting the blob's own mask (light from the top left): pixels whose neighbour (dx, dy) is
 * outside the blob take the shade colour.
 */
function blob(b, shapes, fill, o = {}) {
  const m = buf(b.w, b.h);
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1; // bounding box of the blob, so passes skip empty space
  const mp = (x, y) => {
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    m.d[y * b.w + x] = 1;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  };
  for (const sh of shapes) shape(sh, mp, o.ox || 0, o.oy || 0);
  if (x1 < 0) return m;
  const out = o.outline === undefined ? C.ink : o.outline && ci(o.outline);
  if (out) {
    for (let y = Math.max(0, y0 - 1); y <= Math.min(b.h - 1, y1 + 1); y++) {
      for (let x = Math.max(0, x0 - 1); x <= Math.min(b.w - 1, x1 + 1); x++) {
        if (m.d[y * b.w + x]) continue;
        if (gp(m, x - 1, y) || gp(m, x + 1, y) || gp(m, x, y - 1) || gp(m, x, y + 1)) sp(b, x, y, out);
      }
    }
  }
  const f = ci(fill);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.d[y * b.w + x]) b.d[y * b.w + x] = f;
  for (const [col, dx, dy] of o.shades || []) {
    const k = ci(col);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!m.d[y * b.w + x] || b.d[y * b.w + x] !== f) continue;
        if (!gp(m, x + dx, y + dy)) b.d[y * b.w + x] = k;
      }
    }
  }
  return m;
}
/** Sprite from string rows; map: char -> palette name. */
function stamp(b, rows, map, x, y, flip = false) {
  const wd = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const n = map[row[i]];
      if (n) sp(b, x + (flip ? wd - 1 - i : i), y + j, C[n]);
    }
  });
}
function lightPass(b, fn) {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = y * b.w + x;
      if (!b.d[i]) continue;
      const v = fn(x, y);
      if (!v) continue;
      const n = Math.floor(Math.abs(v) + bay(x, y));
      for (let k = 0; k < n; k++) b.d[i] = v > 0 ? UP[b.d[i]] : DOWN[b.d[i]];
    }
  }
}
function toCanvas(b) {
  const c = K.makeCanvas(b.w, b.h), g = c.getContext('2d');
  const img = g.createImageData(b.w, b.h);
  for (let i = 0; i < b.d.length; i++) {
    const k = b.d[i];
    if (!k) continue;
    const [r, gg, bb] = RGB[k];
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = bb; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
/** Thresholded text mask (pixel fonts rendered at their native grid stay perfectly crisp). */
function textMask(str, px, family) {
  const W = Math.ceil(px * str.length * 1.3) + 8, H = Math.ceil(px * 2.2) + 8;
  const c = K.makeCanvas(W, H), g = c.getContext('2d');
  g.font = K.font(400, px, family);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff';
  g.fillText(str, 4, Math.round(px * 1.5) + 4);
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] >= 120) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  const m = buf(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) m.d[y * m.w + x] = d[((y + y0) * W + x + x0) * 4 + 3] >= 120 ? 1 : 0;
  return m;
}
/** Pixel text sprite: 8-way outline, optional drop/extrude, fill colour chosen per row (bands). */
function textSprite(str, px, family, o) {
  let m = textMask(str, px, family);
  if (o.sx || o.sy) { // integer nearest-neighbour stretch of the glyph grid (tall arcade letters)
    const sx = o.sx || 1, sy = o.sy || 1, m2 = buf(m.w * sx, m.h * sy);
    for (let y = 0; y < m2.h; y++) for (let x = 0; x < m2.w; x++) m2.d[y * m2.w + x] = m.d[Math.floor(y / sy) * m.w + Math.floor(x / sx)];
    m = m2;
  }
  const ex = o.extrude || 0, pad = 1;
  const b = buf(m.w + pad * 2 + ex, m.h + pad * 2 + ex);
  const put = (dx, dy, col) => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) sp(b, x + pad + dx, y + pad + dy, ci(col));
  };
  for (let k = ex; k >= 1; k--) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(k + dx, k + dy, o.outline);
    put(k, k, o.extrudeCol || o.outline);
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(dx, dy, o.outline);
  for (let y = 0; y < m.h; y++) {
    const col = o.bands ? o.bands[Math.min(o.bands.length - 1, Math.floor((y / m.h) * o.bands.length))] : o.fill;
    for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) sp(b, x + pad, y + pad, ci(col));
  }
  return { cv: toCanvas(b), w: b.w, h: b.h };
}

// ---------------------------------------------------------------- layout (art pixels)
const DOG_X = 148, DOG_Y = 147;           // boss: ground centre between the front paws
const DB_W = 150, DB_H = 142, DB_OX = 75, DB_OY = 138; // dog buffer and its origin
const HERO_X = 34, HERO_Y = 153;          // hero: feet centre
const TORCHES = [[20, 70], [224, 70]];

// ---------------------------------------------------------------- the boss
function drawDog(b, X, Y, br, tw = 0) {
  const H = -br; // head rises one pixel on the in-breath
  // ear twitch: the left ear flicks outward
  const twr = (pts) => (tw ? pts.map(([x, y]) => { const a = -0.16, dx = x + 22, dy = y + 97; return [-22 + dx * Math.cos(a) - dy * Math.sin(a), -97 + dx * Math.sin(a) + dy * Math.cos(a)]; }) : pts);
  const P = (pts, oy = 0) => pts.map(([x, y]) => [X + x, Y + y + oy]);
  const E = (x, y, rx, ry) => ['e', X + x, Y + y, rx, ry];
  const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

  // body: shoulders + folded hind legs (orange)
  blob(b, [E(0, -41, 33, 27), E(-34, -15, 15, 14), E(34, -15, 15, 14)],
    'o3', { shades: [['o2', 4, 5], ['o1', 1, 2], ['o4', -3, -4]] });
  // hind paws
  blob(b, [E(-43, -4, 8.5, 4.5), E(43, -4, 8.5, 4.5)], 'w3', { shades: [['w2', 0, 2], ['w1', 1, 1]] });
  for (const s of [-1, 1]) for (const tx of [-3, 1]) sp(b, X + s * 43 + tx, Y - 2, C.w1);
  // fluffy chest bib
  const chest = [E(0, -38, 26, 24)];
  for (const x of [-18, -9, 0, 9, 18]) chest.push(['p', P([[x - 5, -20], [x + 5, -20], [x + 1, -12]])]);
  for (const s of [-1, 1]) chest.push(['p', P([[s * 21, -52], [s * 30, -47], [s * 24, -41], [s * 30, -35], [s * 22, -30]])]);
  blob(b, chest, 'w3', { shades: [['w2', 3, 4], ['w1', 1, 1], ['w4', -3, -3]] });
  // stubby front legs + big boss paws
  blob(b, [E(-12, -16, 7.5, 13), E(12, -16, 7.5, 13)], 'w3', { shades: [['w2', 3, 1], ['w1', 1, 0]] });
  blob(b, [E(-13, -5, 10.5, 5.5), E(13, -5, 10.5, 5.5)], 'w3', { shades: [['w2', 0, 2], ['w1', 1, 1], ['w4', -2, -2]] });
  for (const s of [-1, 1]) {
    for (const tx of [-4, 0, 4]) line(X + s * 13 + tx, Y - 7, X + s * 13 + tx, Y - 4, pen(b, 'w1'));
    for (const tx of [-6, -2, 2, 6]) sp(b, X + s * 13 + tx, Y - 1, C.ink);
  }

  // head: skull, cheeks, snout and jaw are one blob so the outline wraps the chin
  const earL = twr([[-26, -94], [-10, -103], [-17, -116], [-30, -129], [-36, -120], [-35, -104]]);
  const tuftL = [[-33, -74], [-41, -69], [-34, -66], [-39, -61], [-30, -60]];
  blob(b, [E(0, -86, 27, 20), E(-19, -72, 16, 12), E(19, -72, 16, 12), E(0, -64, 15, 10),
    ['p', P(earL, H)], ['p', P(mirror(earL), H)], ['p', P(tuftL, H)], ['p', P(mirror(tuftL), H)]].map((sh) => (sh[0] === 'e' ? ['e', sh[1], sh[2] + H, sh[3], sh[4]] : sh)),
  'o3', { shades: [['o2', 3, 4], ['o1', 1, 2], ['o4', -2, -3]] });
  const fur = ['o1', 'o2', 'o3', 'o4'];
  // inner ears
  const innerL = [[-25, -98], [-15, -104], [-20, -114], [-29, -123], [-32, -111]];
  for (const pts of [twr(innerL), mirror(innerL)]) {
    poly(P(pts, H), pen(b, 'pk2', fur));
    poly(P(pts.map(([x, y]) => [x * 0.8 + (x < 0 ? -5 : 5) * 0.2 + (x < 0 ? -1 : 1), y + 2]), H), pen(b, 'pk1', 'pk2'));
  }
  // white blaze, snout and lower cheeks (only inside the head outline)
  const white = pen(b, 'w3', fur);
  poly(P([[-2, -106], [2, -106], [5, -94], [10, -78], [-10, -78], [-5, -94]], H), white);
  ell(X, Y - 66 + H, 14, 10, white);
  ell(X - 15, Y - 64 + H, 11, 7, white);
  ell(X + 15, Y - 64 + H, 11, 7, white);
  for (let x = X - 30; x <= X + 30; x++) {
    for (let y = Y - 80 + H; y <= Y - 52 + H; y++) {
      if (gp(b, x, y) === C.w3 && gp(b, x, y + 2) === C.ink) sp(b, x, y, C.w2);
    }
  }
  // eyes: round and glowing, cut by angry brows
  for (const s of [-1, 1]) {
    const ex = X + s * 12 + (s < 0 ? 0 : 1), ey = Y - 83 + H;
    ell(ex, ey, 5.6, 5, pen(b, 'ink'));
    ell(ex, ey, 4.5, 4, pen(b, 'eye1'));
    ell(ex - 0.5, ey - 0.8, 3.2, 2.6, pen(b, 'eye2', 'eye1'));
    sp(b, ex - 2, ey - 2, C.eye3); sp(b, ex - 1, ey - 2, C.eye3); sp(b, ex - 2, ey - 1, C.eye3);
    // brow slants down toward the snout and bites into the top of the eye
    for (let k = 0; k < 3; k++) line(X + s * 20, Y - 90 + H + k, X + s * 5, Y - 85 + H + k, pen(b, k < 2 ? 'ink' : 'o1', k < 2 ? undefined : fur));
  }
  // big dog nose
  ell(X, Y - 73 + H, 6.5, 4.2, pen(b, 'nose'));
  rect(X - 3, Y - 76 + H, 3, 1, pen(b, 'noseH'));
  sp(b, X - 4, Y - 75 + H, C.noseH);
  // mouth ("w") + fang
  line(X, Y - 70 + H, X, Y - 67 + H, pen(b, 'ink'));
  line(X, Y - 67 + H, X - 4, Y - 65 + H, pen(b, 'ink'));
  line(X - 4, Y - 65 + H, X - 9, Y - 66 + H, pen(b, 'ink'));
  line(X, Y - 67 + H, X + 4, Y - 65 + H, pen(b, 'ink'));
  line(X + 4, Y - 65 + H, X + 9, Y - 66 + H, pen(b, 'ink'));
  stamp(b, ['kkk', 'k4k', 'k4k', '.k.'], { k: 'ink', 4: 'w4' }, X + 4, Y - 65 + H);
  // the chewed sock, bitten at the cuff, dangling from the corner of the mouth
  stamp(b, [
    '......kkkkkkkkk',
    '......kWWWWWWWk',
    '......kAAAAAABk',
    '......kWWWWWWWk',
    '......kAAAAAABk',
    '......kAAAAAABk',
    '......kAADAAABk',
    '......kAAAAAABk',
    '......kAAAAAABk',
    '....kkkAAAAAABk',
    '..kkAAAAAAAAABk',
    '.kTAAAAAAAAAABk',
    'kTTAAAAAAAAATTk',
    '.kTTAAAAAAATTk.',
    '..kkkkkkkkkkk..',
  ], { k: 'ink', A: 'sB', B: 'hBD', W: 'w3', T: 'sY', D: 'ink' }, X - 19, Y - 67 + H);
  line(X - 13, Y - 66 + H, X - 5, Y - 66 + H, pen(b, 'ink'));
  // tiny crown, slightly tilted
  stamp(b, [
    '..........k.',
    '.k...k...kLk',
    'kLk.kLk.kGGk',
    'kGGkGGGkGGGk',
    'kGGGGGGGGGGk',
    'kGRGGGBGGRGk',
    'kDDDDDDDDDDk',
    '.kkkkkkkkkk.',
  ], { k: 'ink', L: 'goldL', G: 'gold', D: 'goldD', R: 'sR', B: 'sB' }, X + 3, Y - 115 + H);
}

// fluffy question-mark tail, wagging from behind the right hind leg
const TAIL = [[36, -16, 3.5], [42, -21, 5], [48, -28, 6.2], [51, -37, 6.8], [50, -46, 6.2], [45, -52, 5.2], [39, -52, 3.6]];
const TAIL_ANGLES = [-0.3, -0.04, 0.24, -0.04];
function tailRot(ang) {
  const bx = 30, by = -14, ca = Math.cos(ang), sa = Math.sin(ang);
  return ([x, y]) => [bx + (x - bx) * ca - (y - by) * sa, by + (x - bx) * sa + (y - by) * ca];
}
function drawTail(b, X, Y, ang) {
  const rot = tailRot(ang);
  const sh = TAIL.map(([x, y, r]) => { const [x2, y2] = rot([x, y]); return ['e', X + x2, Y + y2, r, r]; });
  for (const [x, y, dx, dy] of [[56, -33, -4, 2], [57, -44, -4, 0], [52, -54, -3, 3], [46, -57, -2, 4], [44, -25, -3, 3]]) {
    const q = [rot([x, y]), rot([x + dx, y + dy + 3]), rot([x + dx - 1, y + dy - 2])];
    sh.push(['p', q.map(([qx, qy]) => [X + qx, Y + qy])]);
  }
  blob(b, sh, 'o3', { shades: [['o2', 3, 3], ['o1', 1, 1], ['o4', -2, -2], ['o5', -1, -1]] });
  // fur strands across the plume
  for (let i = 1; i < TAIL.length - 1; i++) {
    const [x0, y0] = rot(TAIL[i]), [x1, y1] = rot(TAIL[i + 1]);
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    line(X + x0 - nx * 3, Y + y0 - ny * 3, X + x0 + nx * 2 + (x1 - x0) / L, Y + y0 + ny * 2 + (y1 - y0) / L, pen(b, 'o2', ['o3', 'o4', 'o5']));
  }
}

// ---------------------------------------------------------------- hero (facing right)
const HERO = [
  '..RR...........',
  '.RrrR..........',
  '.Rr.rRkkkk.....',
  '..R.kssssmk....',
  '...ksssssmmk...',
  '...ksssssmmk...',
  '...ksskkkkkk...',
  '...kskvevevk...',
  '...ksskkkkkk..w',
  '...kssmmmmk..wk',
  '..bkkkkkkk..wk.',
  '.bBkhhHhk..wk..',
  'bbBkhhHhkkyk...',
  'bBBkhhHhkhyk...',
  'bBBkkkkkkkk....',
  '.bBkmmkmmk.....',
  '..bkmk.kmk.....',
  '..knnk.knnk....',
  '..kkkk.kkkk....',
];
const HERO_MAP = { k: 'ink', s: 'hS', m: 'hM', R: 'hRD', r: 'hR', v: 'hV', e: 'hS', w: 'w4', b: 'hR', B: 'hRD', h: 'hB', H: 'hBD', y: 'gold', n: 'hBt' };

// ---------------------------------------------------------------- small props
const SOCK = [
  '.kkkk...',
  'kSSSSk..',
  'kAAAAk..',
  'kSSSSk..',
  'kAAAAk..',
  'kAAAAkk.',
  'kAAAAAAk',
  'kTAAAATk',
  '.kkkkkk.',
];
const BONE = [
  '.kk.....kk.',
  'kwwkkkkkwwk',
  '.kwwwwwwwk.',
  'kwwkkkkkwwk',
  '.kk.....kk.',
];
const FLAMES = [
  ['...0...', '..01...', '..121..', '.01210.', '.12321.', '0123321', '0123321', '.12332.', '..1221.'],
  ['....0..', '...10..', '..121..', '.01221.', '.12321.', '0123321', '0123321', '.12332.', '..1221.'],
  ['.......', '..0.0..', '..1.1..', '.01210.', '.12321.', '0123321', '0123321', '.12332.', '..1221.'],
  ['..0....', '..10...', '.0121..', '.01210.', '.12321.', '.123321', '0123321', '.12332.', '..1221.'],
];
const FLAME_MAP = { 0: 'f0', 1: 'f1', 2: 'f2', 3: 'f3' };

function drawScene(b) {
  // ---- back wall: indigo bricks
  rect(0, 0, LW, 124, pen(b, 'mortar'));
  for (let row = 0; row < 21; row++) {
    const y0 = row * 6, off = row % 2 ? 6 : 0;
    for (let x0 = -off; x0 < LW; x0 += 12) {
      const v = K.hash(row * 31 + 7, x0 + 40);
      const base = v < 0.18 ? 'wallD' : v > 0.88 ? 'wallL' : 'wall';
      const hi = base === 'wallD' ? 'wall' : base === 'wall' ? 'wallL' : 'wallH';
      rect(x0 + 1, y0 + 1, 11, 5, pen(b, base));
      rect(x0 + 1, y0 + 1, 11, 1, pen(b, hi));
      if (v > 0.5 && v < 0.6) line(x0 + 3, y0 + 2, x0 + 6, y0 + 4, pen(b, 'mortar'));
    }
  }
  // stone skirting
  rect(0, 116, LW, 8, pen(b, 'st'));
  rect(0, 116, LW, 1, pen(b, 'stH'));
  rect(0, 117, LW, 1, pen(b, 'stL'));
  rect(0, 123, LW, 1, pen(b, 'stD'));

  // ---- banners (velvet with a gold paw)
  for (const bx of [40, 196]) {
    rect(bx - 2, 14, 24, 3, pen(b, 'goldD'));
    rect(bx - 2, 14, 24, 1, pen(b, 'gold'));
    poly([[bx, 17], [bx + 20, 17], [bx + 20, 86], [bx + 10, 78], [bx, 86]], pen(b, 'cp'));
    poly([[bx, 17], [bx + 3, 17], [bx + 3, 83], [bx, 86]], pen(b, 'cpL'));
    poly([[bx + 17, 17], [bx + 20, 17], [bx + 20, 86], [bx + 17, 83]], pen(b, 'cpD'));
    rect(bx + 1, 19, 18, 1, pen(b, 'gold', ['cp', 'cpL', 'cpD']));
    rect(bx + 1, 70, 18, 1, pen(b, 'gold', ['cp', 'cpL', 'cpD']));
    // paw emblem
    const px = bx + 10, py = 44;
    ell(px, py + 4, 5, 4.2, pen(b, 'gold'));
    for (const [tx, ty] of [[-5, -3], [-2, -6], [2, -6], [5, -3]]) ell(px + tx, py + ty, 1.8, 2, pen(b, 'gold'));
    ell(px - 1, py + 3, 2, 1.5, pen(b, 'goldL'));
  }

  // ---- throne back (velvet, gold frame) behind the boss
  const tx = DOG_X;
  const throne = (r, p) => { rect(tx - r, 50, r * 2 + 1, 92, p); ell(tx + 0.5, 50, r + 0.5, 26 + (r - 48) * 0.5, p); };
  throne(52, pen(b, 'goldD'));
  throne(50, pen(b, 'gold'));
  throne(48, pen(b, 'vl'));
  for (let y = 26; y < 140; y++) {
    for (let x = tx - 48; x <= tx + 48; x++) {
      if (gp(b, x, y) !== C.vl) continue;
      const u = x - tx, v = y - 30;
      const d = ((u + v) % 16 + 16) % 16, e = ((u - v) % 16 + 16) % 16;
      if (d === 0 || e === 0) sp(b, x, y, C.vlD);
      else if (d === 1 || e === 1) sp(b, x, y, C.vlL);
      if (d === 0 && e === 0) { sp(b, x, y, C.vlH); }
    }
  }
  rect(tx - 50, 138, 101, 4, pen(b, 'goldD'));
  rect(tx - 50, 138, 101, 1, pen(b, 'gold'));

  // ---- pillars at the edges
  for (const [x0, w] of [[0, 9], [231, 9]]) {
    rect(x0, 0, w, 124, pen(b, 'st'));
    rect(x0 + (x0 ? 0 : w - 2), 0, 2, 124, pen(b, x0 ? 'stL' : 'stD'));
    rect(x0 + (x0 ? 2 : 1), 0, 1, 124, pen(b, 'stH'));
    for (let y = 8; y < 124; y += 14) rect(x0, y, w, 1, pen(b, 'stD'));
  }

  // ---- floor: stone slabs converging to the throne
  rect(0, 124, LW, LH - 124, pen(b, 'fl'));
  const VX = DOG_X, VY = 60, D = 4.2;
  const rows = [124, 128, 133, 139, 146, 154, 163, 173, 185];
  for (let r = 0; r + 1 < rows.length; r++) {
    const y0 = rows[r], y1 = rows[r + 1];
    rect(0, y0, LW, 1, pen(b, 'flD'));
    rect(0, y0 + 1, LW, 1, pen(b, 'flL'));
    for (let k = -30; k <= 30; k++) {
      const u = k + (r % 2) * 0.5;
      line(VX + (u * (y0 - VY)) / D, y0 + 1, VX + (u * (y1 - 1 - VY)) / D, y1 - 1, pen(b, 'flD'));
    }
  }
  // ---- dais under the throne
  const dais = (x0, x1, top, face, depth) => {
    rect(x0, top, x1 - x0 + 1, face - top, pen(b, 'stL'));
    rect(x0, top, x1 - x0 + 1, 1, pen(b, 'stH'));
    rect(x0, face, x1 - x0 + 1, depth, pen(b, 'st'));
    rect(x0, face, x1 - x0 + 1, 1, pen(b, 'stD'));
    for (let x = x0 + 6; x < x1; x += 12) line(x, face + 1, x, face + depth - 1, pen(b, 'stD'));
  };
  dais(DOG_X - 74, DOG_X + 74, 150, 154, 6);
  dais(DOG_X - 64, DOG_X + 64, 139, 147, 6);
  // the boss's contact shadow on the dais
  ell(DOG_X, 145.5, 62, 4.5, pen(b, 'st', ['stL', 'stH']));
  ell(DOG_X, 145.5, 50, 3, pen(b, 'stD', ['st']));
  // red carpet up the steps and down the hall
  const cpx = (y) => 20 + (y - 139) * 0.45;
  poly([[DOG_X - 20, 139], [DOG_X + 20, 139], [DOG_X + cpx(LH), LH], [DOG_X - cpx(LH), LH]], pen(b, 'cp', ['stL', 'stH', 'st', 'stD', 'fl', 'flD', 'flL']));
  for (let y = 139; y < LH; y++) {
    const hw = Math.round(cpx(y));
    sp(b, DOG_X - hw, y, C.gold); sp(b, DOG_X + hw, y, C.gold);
    sp(b, DOG_X - hw + 1, y, C.goldD); sp(b, DOG_X + hw - 1, y, C.goldD);
    for (const yy of [147, 153, 160]) if (y === yy) rect(DOG_X - hw + 2, y, hw * 2 - 3, 1, pen(b, 'cpD'));
    for (const yy of [139, 150]) if (y === yy) rect(DOG_X - hw + 2, y, hw * 2 - 3, 1, pen(b, 'cpL'));
  }
  // bones on the floor
  stamp(b, BONE, { k: 'ink', w: 'w2' }, 52, 147);
  stamp(b, BONE, { k: 'ink', w: 'w2' }, 216, 146);
  // hero shadow
  ell(HERO_X + 0.5, HERO_Y + 0.5, 8, 2, pen(b, 'flD'));

  // ---- torches: iron sconce (flames are animated in fg)
  for (const [x, y] of TORCHES) {
    stamp(b, ['kgggggk', '.kgGgk.', '..kmk..', '..kmk..', '.kkmkk.', '...k...'], { k: 'ink', g: 'gold', G: 'goldL', m: 'goldD' }, x - 3, y);
  }

  // ---- lighting: torch pools, dark ceiling and corners
  lightPass(b, (x, y) => {
    let v = 0;
    for (const [tx2, ty2] of TORCHES) {
      const d = Math.hypot(x - tx2, (y - ty2) * 1.1);
      v += Math.max(0, 1 - d / 34) * 2.2;
    }
    v -= Math.max(0, (40 - y) / 40) * 1.6;
    v -= Math.max(0, (Math.abs(x - 120) - 70) / 50) * 1.2;
    v -= Math.max(0, (y - 150) / 30) * 0.8;
    return v;
  });
}

// sock pile in front of the boss's paws (drawn over the boss)
function drawFront(b) {
  const socks = [
    [96, 138, { S: 'sR', A: 'w3', T: 'sB' }, false],
    [104, 141, { S: 'sY', A: 'sB', T: 'sY' }, true],
    [88, 142, { S: 'w3', A: 'sG', T: 'w3' }, false],
    [186, 139, { S: 'sB', A: 'w3', T: 'sR' }, true],
    [194, 142, { S: 'w3', A: 'sR', T: 'w3' }, false],
    [178, 143, { S: 'sR', A: 'sY', T: 'sR' }, true],
  ];
  for (const [x, y, m, flip] of socks) stamp(b, SOCK, { k: 'ink', ...m }, x, y, flip);
}

export function create(w, h) {
  const S = w / LW; // screen pixels per art pixel
  // static scene
  const sceneB = buf(LW, LH);
  drawScene(sceneB);
  const sceneCv = toCanvas(sceneB);
  const frontB = buf(LW, LH);
  drawFront(frontB);
  const frontCv = toCanvas(frontB);
  // boss frames (breath) and tail frames (wag)
  const dogs = [0, 1, 2, 3].map((k) => { const b = buf(DB_W, DB_H); drawDog(b, DB_OX, DB_OY, k & 1, k >> 1); return toCanvas(b); });
  const tails = TAIL_ANGLES.map((a) => { const b = buf(DB_W, DB_H); drawTail(b, DB_OX, DB_OY, a); return toCanvas(b); });
  // hero frames
  const heroCv = [0, 1].map((f) => {
    const rows = f ? ['', ...HERO.slice(0, 15), ...HERO.slice(16)] : HERO;
    const b = buf(16, 20);
    stamp(b, rows, HERO_MAP, 0, 0);
    return toCanvas(b);
  });
  const bang = (() => { const b = buf(7, 11); stamp(b, ['.kkkkk.', 'kwwwwwk', 'kwrrrwk', 'kwrrrwk', 'kwrrrwk', 'kwwrwwk', 'kwwwwwk', 'kwwrwwk', 'kwwwwwk', '.kkwkk.', '...k...'], { k: 'ink', w: 'w4', r: 'hR' }, 0, 0); return toCanvas(b); })();
  const flames = FLAMES.map((rows) => { const b = buf(7, 9); stamp(b, rows, FLAME_MAP, 0, 0); return toCanvas(b); });

  // UI text sprites
  const label = textSprite('BISCUIT, DEVOURER OF SOCKS', 8, 'Press Start 2P', { outline: 'uiK', fill: 'uiW' });
  const FB = { outline: 'ink', extrude: 2, extrudeCol: 'cpD', sx: 2, sy: 3 };
  const fbA = textSprite('FINAL BOSS', 8, 'Press Start 2P', { ...FB, bands: ['f3', 'f2', 'f2', 'f2', 'f1', 'f1', 'f1', 'f0'] });
  const fbB = textSprite('FINAL BOSS', 8, 'Press Start 2P', { ...FB, bands: ['hp3', 'hp2', 'hp2', 'hp2', 'hp1', 'hp1', 'hp1', 'hp0'] });
  const fbW = textSprite('FINAL BOSS', 8, 'Press Start 2P', { ...FB, bands: ['w4'] });

  const comp = K.makeCanvas(LW, LH), cc = comp.getContext('2d');
  cc.imageSmoothingEnabled = false;

  // soft light sprites (full resolution) for the torches and the boss's eyes
  const glowSprite = (r, stops) => {
    const c = K.makeCanvas(r * 2, r * 2), g = c.getContext('2d');
    g.fillStyle = K.radGrad(g, r, r, 0, r, stops);
    g.fillRect(0, 0, r * 2, r * 2);
    g.getImageData(0, 0, 1, 1); // finish the deferred raster now, not on the first frame
    return c;
  };
  const torchGlow = glowSprite(Math.ceil(40 * S), [[0, 'rgba(255,170,70,0.42)'], [0.35, 'rgba(255,120,40,0.16)'], [1, 'rgba(255,90,30,0)']]);
  const eyeGlow = glowSprite(Math.ceil(12 * S), [[0, 'rgba(255,200,90,0.85)'], [0.3, 'rgba(255,90,40,0.35)'], [1, 'rgba(255,40,20,0)']]);

  const BAR_X = 16, BAR_Y = 13, BAR_W = 208;
  return {
    bg(ctx) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sceneCv, 0, 0, w, h);
      // HP bar frame + bottom title band (static UI)
      const k = (x, y, ww, hh, col) => { const X0 = Math.round(x * S), Y0 = Math.round(y * S); ctx.fillStyle = col; ctx.fillRect(X0, Y0, Math.round((x + ww) * S) - X0, Math.round((y + hh) * S) - Y0); };
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 26 * S, [[0, 'rgba(6,4,26,0.92)'], [0.75, 'rgba(6,4,26,0.6)'], [1, 'rgba(6,4,26,0)']]);
      ctx.fillRect(0, 0, w, 26 * S);
      ctx.fillStyle = K.linGrad(ctx, 0, 152 * S, 0, h, [[0, 'rgba(6,4,26,0)'], [0.3, 'rgba(6,4,26,0.75)'], [1, 'rgba(6,4,26,0.92)']]);
      ctx.fillRect(0, 152 * S, w, h - 152 * S);
      k(BAR_X - 1, BAR_Y - 1, BAR_W + 2, 10, COL.uiK);
      k(BAR_X, BAR_Y, BAR_W, 8, COL.uiW);
      k(BAR_X + 1, BAR_Y + 1, BAR_W - 2, 6, COL.uiK);
      k(BAR_X + 2, BAR_Y + 2, BAR_W - 4, 4, COL.hpE);
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    },
    fg(ctx, t) {
      ctx.save();
      cc.clearRect(0, 0, LW, LH);
      const f = Math.floor(t * 10);
      TORCHES.forEach(([x, y], i) => cc.drawImage(flames[(f + i * 2 + (K.hash(f, i) < 0.3 ? 1 : 0)) % 4], x - 3, y - 9));
      TORCHES.forEach(([x, y], i) => {
        for (let k = 0; k < 4; k++) {
          const e = (t * 0.7 + k * 0.25 + i * 0.13) % 1;
          if (e > 0.85) continue;
          cc.fillStyle = e < 0.3 ? COL.f2 : e < 0.6 ? COL.f1 : COL.f0;
          cc.fillRect(x + Math.round(Math.sin(e * 7 + k * 2 + i) * 2.5), y - 10 - Math.floor(e * 30), 1, 1);
        }
      });
      // boss
      const dx = DOG_X - DB_OX, dy = DOG_Y - DB_OY;
      const wag = Math.floor(t * 9) % 4;
      cc.drawImage(tails[wag], dx, dy);
      const br = Math.sin(t * Math.PI * 2 * 0.65) > 0 ? 1 : 0;
      const tw = (t % 3.3) > 2.2 && (t % 3.3) < 2.36 ? 2 : 0;
      cc.drawImage(dogs[br + tw], dx, dy);
      cc.drawImage(frontCv, 0, 0);
      // a glint on the tiny crown every couple of seconds
      const gp2 = (t % 2.2) / 2.2;
      if (t > 1 && gp2 < 0.12) {
        const gx = DOG_X + 4, gy = DOG_Y - 115 - br, big = gp2 > 0.03 && gp2 < 0.09;
        cc.fillStyle = COL.w4;
        cc.fillRect(gx, gy, 1, 1);
        cc.fillStyle = COL.goldL;
        cc.fillRect(gx - 1, gy, 1, 1); cc.fillRect(gx + 1, gy, 1, 1); cc.fillRect(gx, gy - 1, 1, 1); cc.fillRect(gx, gy + 1, 1, 1);
        if (big) { cc.fillRect(gx - 2, gy, 1, 1); cc.fillRect(gx + 2, gy, 1, 1); cc.fillRect(gx, gy - 2, 1, 1); cc.fillRect(gx, gy + 2, 1, 1); }
      }
      // hero
      const hf = Math.floor(t * 2.4) % 2;
      cc.drawImage(heroCv[hf], HERO_X - 7, HERO_Y - 18);
      if (t > 0.7) { // "!" emote over the hero
        const ey = HERO_Y - 31 - (t < 0.85 ? 2 : 0) + hf;
        cc.drawImage(bang, HERO_X - 3, ey);
      }
      if (wag === 0 || wag === 2) { // motion marks on the side the tail is swinging to
        const side = wag === 2 ? 1 : -1;
        const [tx0, ty0] = tailRot(TAIL_ANGLES[wag])([50 + side * 12, -44]);
        const mx = Math.round(DOG_X + tx0), my = Math.round(DOG_Y + ty0);
        cc.fillStyle = COL.w3;
        cc.fillRect(mx, my - 4, 1, 3); cc.fillRect(mx + side, my + 1, 1, 3); cc.fillRect(mx, my + 6, 1, 3);
      }
      // HP label types in, bar fills, then shimmers
      const typed = K.clamp((t - 0.42) / 0.38) * 26;
      if (typed > 0) cc.drawImage(label.cv, 0, 0, 1 + Math.ceil(typed) * 8, label.h, (LW - label.w) >> 1, 2, 1 + Math.ceil(typed) * 8, label.h);
      const fill = Math.floor(K.easeOutCubic((t - 0.55) / 0.5) * 51) * 4;
      if (fill > 0) {
        const x0 = BAR_X + 2, y0 = BAR_Y + 2;
        cc.fillStyle = COL.hp1; cc.fillRect(x0, y0, fill, 4);
        cc.fillStyle = COL.hp3; cc.fillRect(x0, y0, fill, 1);
        cc.fillStyle = COL.hp2; cc.fillRect(x0, y0 + 1, fill, 1);
        cc.fillStyle = COL.hp0; cc.fillRect(x0, y0 + 3, fill, 1);
        cc.fillStyle = COL.hpE;
        for (let x = x0 + 7; x < x0 + fill; x += 8) cc.fillRect(x, y0 + 1, 1, 3);
        const sh = ((t - 1.1) * 140) % 420;
        if (t > 1.1 && sh < fill) { cc.fillStyle = COL.w4; cc.fillRect(x0 + Math.floor(sh), y0, 2, 4); cc.fillStyle = COL.hp3; cc.fillRect(x0 + Math.floor(sh) - 2, y0, 2, 4); }
      }
      // FINAL BOSS: slams in from 0.2 s, lands at 0.4 s with a white flash, then flashes
      const land = 0.4;
      if (t > 0.2) {
        const p = K.clamp((t - 0.2) / (land - 0.2));
        const sc = t < land ? 1 + 2.2 * (1 - K.easeInCubic(p)) : 1;
        let spr = fbA;
        if (t >= land && t < land + 0.12) spr = fbW;
        else if (t >= land + 0.12 && ((t * 2.6) % 1) > 0.62) spr = fbB;
        const ww = Math.round(spr.w * sc), hh = Math.round(spr.h * sc);
        cc.globalAlpha = K.clamp(p * 3);
        cc.drawImage(spr.cv, Math.round(120 - ww / 2), Math.round(166 - hh / 2), ww, hh);
        cc.globalAlpha = 1;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(comp, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;

      // light: torch glow flicker + glowing eyes
      ctx.globalCompositeOperation = 'lighter';
      TORCHES.forEach(([x, y], i) => {
        ctx.globalAlpha = 0.75 + 0.25 * K.hash(Math.floor(t * 12), i + 5);
        ctx.drawImage(torchGlow, (x + 0.5) * S - torchGlow.width / 2, (y - 4) * S - torchGlow.height / 2);
      });
      const eyeOn = K.smooth(0.25, 0.45, t);
      const pulse = 0.7 + 0.3 * Math.sin(t * 5.2);
      if (eyeOn > 0) {
        ctx.globalAlpha = eyeOn * pulse;
        for (const s of [-1, 1]) ctx.drawImage(eyeGlow, (DOG_X + s * 12 + (s < 0 ? 0 : 1)) * S - eyeGlow.width / 2, (DOG_Y - 83.5 - br) * S - eyeGlow.height / 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // landing flash
      if (t > land && t < land + 0.1) {
        ctx.fillStyle = `rgba(255,240,220,${(0.2 * (1 - (t - land) / 0.1)).toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    },
  };
}
