// BLAZING FISTS: a made-up arcade fighting game's title screen.
// Two original fighters face off as backlit silhouettes: a lean martial artist with burning fists
// (rim-lit fire orange) and a hooded hulking brawler with crackling fists (rim-lit electric blue).
import * as K from './kit.js';

export const meta = { id: 'fighter', title: 'BLAZING FISTS', aspect: 16 / 9 };

/* ------------------------------------------------------------------ path helpers (design units) */

// Catmull-Rom spline through pts; a point [x, y, 1] is a sharp corner.
function spline(c, pts, closed = true) {
  const n = pts.length;
  if (closed) { // force clockwise (screen space) so overlapping shapes union under nonzero fill
    let a = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
    if (a < 0) pts = [...pts].reverse();
  }
  const P = (i) => pts[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  c.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k1 = p1[2] ? 0 : 1 / 6, k2 = p2[2] ? 0 : 1 / 6;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1,
      p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}

// Tapered limb: two circles joined by their outer tangents.
function capsule(c, x1, y1, r1, x2, y2, r2) {
  const a = Math.atan2(y2 - y1, x2 - x1), d = Math.hypot(x2 - x1, y2 - y1);
  const th = Math.acos(K.clamp((r1 - r2) / d, -1, 1));
  c.moveTo(x1 + r1 * Math.cos(a - th), y1 + r1 * Math.sin(a - th));
  c.lineTo(x2 + r2 * Math.cos(a - th), y2 + r2 * Math.sin(a - th));
  c.arc(x2, y2, r2, a - th, a + th, false);
  c.lineTo(x1 + r1 * Math.cos(a + th), y1 + r1 * Math.sin(a + th));
  c.arc(x1, y1, r1, a + th, a - th, false);
  c.closePath();
}

function ell(c, x, y, rx, ry, rot = 0) {
  c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  c.ellipse(x, y, rx, ry, rot, 0, K.TAU);
  c.closePath();
}

// Rotated rounded rectangle added to the current path.
function rr(c, cx, cy, w, h, r, rot = 0) {
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  const pts = [[x0 + r, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0], [x0, y0, x1, y0]];
  let p = P(pts[0][0], pts[0][1]);
  c.moveTo(p[0], p[1]);
  for (let i = 1; i < pts.length; i++) {
    const a = P(pts[i][0], pts[i][1]), b = P(pts[i][2], pts[i][3]);
    c.arcTo(a[0], a[1], b[0], b[1], r);
  }
  c.closePath();
}

// Tapered ribbon along a centre line (hair, sash tails).
function ribbon(c, pts, w0, w1) {
  const n = pts.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const wi = K.lerp(w0, w1, i / (n - 1)) / 2;
    A.push([pts[i][0] - dy * wi, pts[i][1] + dx * wi]);
    B.push([pts[i][0] + dy * wi, pts[i][1] - dx * wi]);
  }
  spline(c, [...A, ...B.reverse()], true);
}

/* ------------------------------------------------------------------ lit silhouette builder */

// Conservative bounds of a part's path (design units), so per-part work stays local.
function pathBounds(path) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x, y, r = 0) => {
    b.x0 = Math.min(b.x0, x - r); b.y0 = Math.min(b.y0, y - r); b.x1 = Math.max(b.x1, x + r); b.y1 = Math.max(b.y1, y + r);
  };
  path({
    moveTo: add, lineTo: add, closePath() {},
    bezierCurveTo: (a, c, d, e, f, g) => { add(a, c); add(d, e); add(f, g); },
    quadraticCurveTo: (a, c, d, e) => { add(a, c); add(d, e); },
    arc: (x, y, r) => add(x, y, r), ellipse: (x, y, rx, ry) => add(x, y, Math.max(rx, ry)),
    arcTo: (a, c, d, e) => { add(a, c); add(d, e); },
  });
  return b;
}

// Parts are drawn back to front, near-black, each with a faint directional rim (so overlapping limbs
// still read), then the whole silhouette gets a hot crisp rim with a soft falloff and an outer bleed.
// lights: [{ dx, dy (unit vector toward the light), color, hot, a, thin, wide }]
function litFigure(W, H, s, ox, parts, look) {
  const fig = K.makeCanvas(W, H), f = fig.getContext('2d');
  const tmp = K.makeCanvas(W, H), t = tmp.getContext('2d');
  const band = K.makeCanvas(W, H), b = band.getContext('2d');
  // the soft "volume" light is blurred at half resolution (same look, a fraction of the cost)
  const HW = Math.ceil(W / 2), HH = Math.ceil(H / 2);
  const half = K.makeCanvas(HW, HH), hb = half.getContext('2d');
  const half2 = K.makeCanvas(HW, HH), h2 = half2.getContext('2d');
  const xf = (c, dx = 0, dy = 0) => c.setTransform(s, 0, 0, s, (dx - ox) * s, dy * s);
  const id = (c) => c.setTransform(1, 0, 0, 1, 0, 0);
  for (const part of parts) {
    const bb = pathBounds(part.path), pad = 30 * s;
    const rx = Math.max(0, Math.floor((bb.x0 - ox) * s - pad)), ry = Math.max(0, Math.floor(bb.y0 * s - pad));
    const rw = Math.min(W, Math.ceil((bb.x1 - ox) * s + pad)) - rx, rh = Math.min(H, Math.ceil(bb.y1 * s + pad)) - ry;
    if (rw <= 0 || rh <= 0) continue;
    const blit = (dst, src) => dst.drawImage(src, rx, ry, rw, rh, rx, ry, rw, rh);
    const crescent = (L, k, color) => {
      id(b); b.globalCompositeOperation = 'source-over'; b.clearRect(rx, ry, rw, rh);
      xf(b); b.beginPath(); part.path(b); b.fillStyle = color; b.fill();
      b.globalCompositeOperation = 'destination-out';
      xf(b, -L.dx * k, -L.dy * k); b.beginPath(); part.path(b); b.fill();
      b.globalCompositeOperation = 'source-over';
    };
    id(t); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(rx, ry, rw, rh);
    xf(t); t.beginPath(); part.path(t);
    t.fillStyle = part.fill || look.base(t); t.fill();
    for (const L of look.lights) {
      const e = (part.edge ?? 0.3) * L.a, v = (part.vol ?? 0.5) * L.a;
      if (v > 0.01) {
        const hx = Math.floor(rx / 2), hy = Math.floor(ry / 2), hw = Math.ceil(rw / 2) + 1, hh = Math.ceil(rh / 2) + 1;
        const k = L.wide * 1.6, hs = s / 2;
        id(hb); hb.globalCompositeOperation = 'source-over'; hb.clearRect(hx, hy, hw, hh);
        hb.setTransform(hs, 0, 0, hs, -ox * hs, 0); hb.beginPath(); part.path(hb); hb.fillStyle = L.color; hb.fill();
        hb.globalCompositeOperation = 'destination-out';
        hb.setTransform(hs, 0, 0, hs, (-L.dx * k - ox) * hs, -L.dy * k * hs); hb.beginPath(); part.path(hb); hb.fill();
        hb.globalCompositeOperation = 'source-over';
        h2.clearRect(hx, hy, hw, hh);
        h2.filter = `blur(${(L.wide * 0.35 * s).toFixed(1)}px)`; h2.drawImage(half, hx, hy, hw, hh, hx, hy, hw, hh); h2.filter = 'none';
        id(t); t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.28 * v;
        t.drawImage(half2, hx, hy, hw, hh, hx * 2, hy * 2, hw * 2, hh * 2);
      }
      if (e > 0.01) {
        crescent(L, L.thin * 0.8, L.color);
        id(t); t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.8 * e; blit(t, band);
      }
      t.globalAlpha = 1;
    }
    if (part.detail) { xf(t); t.globalCompositeOperation = 'source-atop'; part.detail(t); }
    id(t); t.globalCompositeOperation = 'source-over';
    blit(f, tmp);
  }
  // light from the fire below, wrapping the lower body
  if (look.under) {
    f.globalCompositeOperation = 'source-atop';
    f.fillStyle = K.linGrad(f, 0, H * 0.45, 0, H, [[0, 'rgba(0,0,0,0)'], [1, look.under]]);
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'source-over';
  }
  // whole-silhouette rim: hot crisp edge, soft falloff inside, bleed outside
  const glow = K.makeCanvas(W, H), g = glow.getContext('2d');
  const mask = (k, color) => {
    id(b); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H);
    b.drawImage(fig, 0, 0);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = color; b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'destination-out'; b.drawImage(fig, -k.dx * s, -k.dy * s);
    b.globalCompositeOperation = 'source-over';
  };
  const lit = K.makeCanvas(W, H), l = lit.getContext('2d');
  for (const L of look.lights) {
    mask({ dx: L.dx * L.wide, dy: L.dy * L.wide }, L.color);
    l.globalAlpha = 0.55 * L.a; l.filter = `blur(${(L.wide * 0.45 * s).toFixed(1)}px)`; l.drawImage(band, 0, 0);
    l.filter = 'none';
    mask({ dx: L.dx * L.thin, dy: L.dy * L.thin }, L.hot || L.color);
    l.globalAlpha = L.a; l.drawImage(band, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.filter = `blur(${(6 * s).toFixed(1)}px)`; g.globalAlpha = 0.7 * L.a; g.drawImage(band, 0, 0);
    g.filter = `blur(${(20 * s).toFixed(1)}px)`; g.globalAlpha = 0.5 * L.a; g.drawImage(band, 0, 0);
    g.filter = 'none'; g.globalAlpha = 1;
  }
  l.globalAlpha = 1; l.globalCompositeOperation = 'destination-in'; l.drawImage(fig, 0, 0);
  f.drawImage(lit, 0, 0);
  return { fig, glow };
}

/* ------------------------------------------------------------------ the two fighters */

// Fist past the wrist of a forearm (elbow -> wrist): a block with knuckle bumps on the far end and a thumb.
function fist(c, ex, ey, wx, wy, L, W, thumb = 1) {
  const a = Math.atan2(wy - ey, wx - ex), ca = Math.cos(a), sa = Math.sin(a);
  const cx = wx + ca * L * 0.4, cy = wy + sa * L * 0.4;
  rr(c, cx, cy, L, W, Math.min(L, W) * 0.3, a);
  const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  for (let i = 0; i < 4; i++) { const [kx, ky] = P(L * 0.42, (i - 1.5) * W * 0.23); ell(c, kx, ky, L * 0.13, W * 0.13, a); }
  const [tx, ty] = P(L * 0.08, thumb * W * 0.48); ell(c, tx, ty, L * 0.3, W * 0.15, a);
}

// Lean martial artist, facing right. Fire behind him (upper left), the clash light in front (right).
function leanParts() {
  return [
    { path: (c) => { // ponytail, two strands flowing back
      ribbon(c, [[272, 128], [232, 120], [188, 124], [148, 140], [108, 140], [74, 124], [46, 100]], 54, 4);
      ribbon(c, [[264, 142], [224, 150], [182, 166], [144, 178], [110, 176]], 30, 3);
      ribbon(c, [[268, 116], [230, 102], [194, 94], [160, 82]], 22, 3);
    }, edge: 0.8, vol: 0.8 },
    { path: (c) => { // sash tails flowing back
      ribbon(c, [[268, 582], [236, 594], [206, 600], [176, 614], [148, 636]], 36, 12);
      ribbon(c, [[268, 592], [246, 614], [228, 640], [216, 670]], 30, 12);
    }, edge: 0.6, vol: 0.6 },
    { path: (c) => { // lead (far) arm
      ell(c, 445, 300, 36, 42, 0.5);
      capsule(c, 448, 306, 30, 520, 372, 22);
      ell(c, 488, 346, 36, 22, 0.75);
      capsule(c, 520, 372, 24, 566, 290, 16);
      ell(c, 536, 346, 18, 32, 0.5);
    }, edge: 0.35 },
    { path: (c) => fist(c, 520, 372, 566, 290, 54, 50, -1), edge: 0.5 },
    { path: (c) => spline(c, [[254, 600], [406, 594], [430, 650], [448, 722, 1], [204, 722, 1], [226, 650]]), edge: 0.2 },
    { path: (c) => spline(c, [ // torso, V-shaped
      [222, 272], [262, 256], [300, 250], [352, 252], [402, 262], [438, 280], [452, 312], [440, 352], [428, 384],
      [418, 420], [406, 470], [398, 520], [394, 568], [262, 574], [252, 520], [240, 470], [226, 420], [210, 370],
      [200, 320], [204, 290]]), edge: 0.25,
    detail: (c) => {
      c.lineCap = 'round'; c.lineWidth = 2.5;
      c.strokeStyle = 'rgba(255,190,110,0.09)';
      c.beginPath(); c.moveTo(306, 300); c.quadraticCurveTo(360, 380, 430, 350); c.stroke();
      c.beginPath(); c.moveTo(362, 390); c.lineTo(366, 556); c.stroke();
      for (const y of [430, 470, 512]) { c.beginPath(); c.moveTo(326, y); c.quadraticCurveTo(366, y + 9, 400, y - 2); c.stroke(); }
    } },
    { path: (c) => spline(c, [[302, 214], [354, 220], [364, 262], [290, 266]]), edge: 0.2 }, // neck
    { path: (c) => spline(c, [ // head, profile facing right
      [300, 104], [338, 110], [360, 130], [368, 150, 1], [371, 160], [386, 182, 1], [374, 190], [378, 200],
      [371, 210], [374, 222, 1], [358, 236], [330, 240], [302, 226], [282, 196], [274, 160], [280, 124]]), edge: 0.6 },
    { path: (c) => spline(c, [ // swept-back spiky hair
      [366, 134], [356, 108], [336, 92], [300, 76], [246, 68, 1], [272, 92], [212, 96, 1], [256, 112], [204, 134, 1],
      [258, 136], [236, 166, 1], [272, 160], [276, 192, 1], [292, 170], [300, 134], [334, 120]]), edge: 0.8 },
    { path: (c) => spline(c, [[256, 560, 1], [402, 552, 1], [406, 596, 1], [254, 604, 1]]), edge: 0.4 }, // sash
    { path: (c) => { // knot + front tails
      ell(c, 398, 578, 18, 15);
      ribbon(c, [[398, 584], [408, 624], [402, 664], [412, 704]], 24, 16);
      ribbon(c, [[392, 586], [382, 628], [390, 680]], 20, 12);
    }, edge: 0.5 },
    { path: (c) => { // near (rear) arm, guard at the chin
      ell(c, 212, 302, 40, 46, -0.2);
      capsule(c, 214, 310, 34, 262, 425, 25);
      ell(c, 222, 366, 26, 46, -0.35);
      ell(c, 252, 360, 26, 42, -0.4);
      capsule(c, 262, 425, 27, 352, 318, 18);
      ell(c, 290, 394, 25, 40, 0.75);
    }, edge: 0.6 },
    { path: (c) => fist(c, 262, 425, 352, 318, 56, 52, -1), edge: 0.7 },
  ];
}

// Hooded hulking brawler, facing left. Electric light behind (upper right), the clash light in front (left).
function bruteParts() {
  return [
    { path: (c) => { // lead (far) arm
      ell(c, 858, 300, 60, 64);
      capsule(c, 850, 312, 52, 790, 428, 40);
      ell(c, 812, 372, 46, 58, 0.5);
      capsule(c, 790, 428, 44, 752, 322, 30);
      ell(c, 778, 392, 38, 50, 0.35);
    }, edge: 0.35 },
    { path: (c) => rr(c, 760, 342, 86, 46, 12, -0.35), edge: 0.5 }, // bracer
    { path: (c) => fist(c, 790, 428, 752, 322, 92, 88, 1), edge: 0.6 },
    { path: (c) => spline(c, [[892, 668], [1160, 662], [1186, 722, 1], [866, 722, 1]]), edge: 0.2 }, // pants
    { path: (c) => spline(c, [ // massive torso
      [842, 280], [880, 252], [930, 236], [1000, 240], [1070, 238], [1130, 248], [1176, 270], [1206, 320], [1196, 390],
      [1178, 460], [1164, 540], [1160, 640], [900, 646], [890, 560], [874, 470], [856, 390], [840, 330]]), edge: 0.25,
    detail: (c) => {
      c.lineCap = 'round'; c.lineWidth = 3;
      c.strokeStyle = 'rgba(255,170,100,0.09)';
      c.beginPath(); c.moveTo(888, 320); c.quadraticCurveTo(940, 404, 1016, 380); c.stroke();
      c.strokeStyle = 'rgba(120,200,255,0.09)';
      c.beginPath(); c.moveTo(1016, 380); c.quadraticCurveTo(1094, 404, 1150, 330); c.stroke();
      c.beginPath(); c.moveTo(1016, 300); c.lineTo(1018, 610); c.stroke();
      for (const y of [436, 484, 532]) { c.beginPath(); c.moveTo(958, y); c.quadraticCurveTo(1018, y + 12, 1084, y - 2); c.stroke(); }
    } },
    { path: (c) => { // open sleeveless hoodie
      spline(c, [[872, 262], [934, 246], [960, 330], [948, 470], [934, 642, 1], [900, 646, 1], [888, 520], [866, 384]]);
      spline(c, [[1084, 246], [1150, 256], [1190, 330], [1170, 470], [1160, 640, 1], [1104, 642, 1], [1084, 470], [1070, 330]]);
    }, edge: 0.45, fill: '#06060c' },
    { path: (c) => spline(c, [ // hood
      [930, 246], [922, 206], [916, 160], [912, 128, 1], [934, 104], [968, 88], [1010, 84], [1048, 96], [1074, 122],
      [1088, 156], [1096, 196, 1], [1090, 220], [1112, 246], [1060, 258], [1000, 258], [960, 252]]), edge: 0.8 },
    { path: (c) => spline(c, [[922, 138], [948, 128], [980, 134], [996, 170], [990, 208], [962, 232], [936, 236],
      [926, 200]]), edge: 0.0, vol: 0.0, fill: '#020205' }, // face deep in the hood
    { path: (c) => spline(c, [[912, 214], [928, 230], [964, 240], [960, 256], [922, 254], [904, 238]]), edge: 0.7 }, // jaw
    { path: (c) => spline(c, [[896, 628, 1], [1160, 622, 1], [1164, 668, 1], [894, 676, 1]]), edge: 0.5 }, // belt
    { path: (c) => rr(c, 1024, 650, 74, 54, 8), edge: 0.6, fill: '#101018' }, // buckle
    { path: (c) => { // near (rear) arm, cocked at the belly
      ell(c, 1176, 300, 66, 70);
      capsule(c, 1180, 312, 56, 1212, 476, 42);
      capsule(c, 1212, 476, 46, 1112, 486, 33);
      ell(c, 1176, 478, 50, 38, 0.1);
    }, edge: 0.7 },
    { path: (c) => { // spiked pauldron
      ell(c, 1170, 278, 72, 48, -0.25);
      for (const [x, y, a] of [[1150, 240, -1.75], [1196, 246, -1.2], [1230, 274, -0.6]]) {
        spline(c, [[x - 13 * Math.sin(a), y + 13 * Math.cos(a), 1], [x + 52 * Math.cos(a), y + 52 * Math.sin(a), 1],
          [x + 13 * Math.sin(a), y - 13 * Math.cos(a), 1]]);
      }
    }, edge: 0.9, fill: '#0b0c16' },
    { path: (c) => rr(c, 1128, 484, 50, 92, 12, -0.08), edge: 0.6 }, // bracer
    { path: (c) => fist(c, 1212, 476, 1112, 486, 96, 90, 1), edge: 0.8 },
  ];
}

/* ------------------------------------------------------------------ fire */

function tongue(c, x, y, w, h, bend, stops) {
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.bezierCurveTo(x - w * 0.6, y - h * 0.45, x + bend * 0.1 - w * 0.25, y - h * 0.72, x + bend, y - h);
  c.bezierCurveTo(x + bend * 0.35 + w * 0.22, y - h * 0.62, x + w * 0.62, y - h * 0.38, x + w / 2, y);
  c.closePath();
  c.fillStyle = K.linGrad(c, 0, y, 0, y - h, stops);
  c.fill();
}

const FIRE = [
  [[0, 'rgba(255,70,12,0.55)'], [0.55, 'rgba(200,24,6,0.32)'], [1, 'rgba(120,0,0,0)']],
  [[0, 'rgba(255,150,34,0.62)'], [0.6, 'rgba(255,82,12,0.34)'], [1, 'rgba(255,40,0,0)']],
  [[0, 'rgba(255,244,190,0.7)'], [0.5, 'rgba(255,196,70,0.42)'], [1, 'rgba(255,120,20,0)']],
];
const FIRE_SOFT = FIRE.map((st) => [[0, st[0][1].replace(/[\d.]+\)$/, '0)')], [0.22, st[0][1]], ...st.slice(1)]);

// A strip of flames along the bottom edge, taller at the sides.
function flameStrip(w, s, seed) {
  const H = 260 * s, c = K.makeCanvas(w, H), x = c.getContext('2d');
  const r = K.rng(seed);
  x.globalCompositeOperation = 'lighter';
  const passes = [[30, 110, 230, 60, 120], [34, 70, 150, 40, 84], [38, 34, 86, 26, 52]];
  passes.forEach(([n, h0, h1, w0, w1], pi) => {
    for (let i = 0; i < n; i++) {
      const fx = ((i + r() * 0.8) / n) * 1280;
      const side = 0.45 + 0.55 * Math.pow(Math.abs(fx - 640) / 640, 0.8);
      const hh = (h0 + r() * (h1 - h0)) * side;
      tongue(x, fx * s, H + 6 * s, (w0 + r() * (w1 - w0)) * s, hh * s, (r() - 0.5) * 50 * s, FIRE[pi]);
    }
  });
  const out = K.makeCanvas(w, H), o = out.getContext('2d');
  o.filter = `blur(${(2.5 * s).toFixed(1)}px)`; o.drawImage(c, 0, 0);
  return out;
}

// Flames wrapping a fist and rising off it. Fist centre at (80, 140) in a 160x210 (design) sprite.
function fistFire(s, seed) {
  const W = 160 * s, H = 210 * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
  const r = K.rng(seed);
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = K.radGrad(x, 80 * s, 140 * s, 0, 58 * s, [[0, 'rgba(255,240,190,0.75)'], [0.45, 'rgba(255,150,40,0.4)'], [1, 'rgba(255,60,0,0)']]);
  x.fillRect(0, 0, W, H);
  [[10, 60, 130, 22, 40], [11, 40, 92, 16, 30], [9, 20, 56, 10, 20]].forEach(([n, h0, h1, w0, w1], pi) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + 0.9 * ((i + r()) / n));
      const bx = 80 + Math.cos(a) * 30, by = 140 + Math.sin(a) * 22 + 6;
      const up = 0.55 + 0.45 * Math.sin(-a);
      tongue(x, bx * s, (by + 14) * s, (w0 + r() * (w1 - w0)) * s, ((h0 + r() * (h1 - h0)) * up + 14) * s, (Math.cos(a) * 18 + (r() - 0.5) * 24) * s, FIRE_SOFT[pi]);
    }
  });
  const out = K.makeCanvas(W, H), o = out.getContext('2d');
  o.filter = `blur(${(1.2 * s).toFixed(1)}px)`; o.drawImage(c, 0, 0);
  return out;
}

function glowSprite(R, stops) {
  const c = K.makeCanvas(R * 2, R * 2), x = c.getContext('2d');
  x.fillStyle = K.radGrad(x, R, R, 0, R, stops);
  x.fillRect(0, 0, R * 2, R * 2);
  return c;
}

/* ------------------------------------------------------------------ logo */

// One logo line: glow, deep extrusion, dark + gold + dark outlines, fire-metal fill with bevel.
function logoLine(text, px, s, skew, pal) {
  const family = 'Bungee';
  const meas = K.makeCanvas(4, 4).getContext('2d');
  meas.font = K.font(400, px * s, family);
  const m = meas.measureText(text);
  const asc = m.actualBoundingBoxAscent, desc = Math.max(0, m.actualBoundingBoxDescent);
  const tw = m.width;
  const ow = px * 0.2 * s; // outer outline width
  const ext = { dx: px * 0.05 * s, dy: px * 0.13 * s };
  const pad = px * 0.32 * s;
  const W = tw + asc * skew + pad * 2 + ext.dx, H = asc + desc + pad * 2 + ext.dy;
  const c = K.makeCanvas(W, H), x = c.getContext('2d');
  const bx = pad, by = pad + asc;
  const setup = (ctx) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(bx, by); ctx.transform(1, 0, -skew, 1, 0, 0);
    ctx.font = K.font(400, px * s, family); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  };
  const top = -asc, bot = desc;
  // glow
  const gl = K.makeCanvas(W, H), g = gl.getContext('2d');
  setup(g); g.strokeStyle = g.fillStyle = '#1a0200'; g.lineWidth = ow * 2.2;
  g.strokeText(text, ext.dx, ext.dy); g.fillText(text, ext.dx, ext.dy);
  x.filter = `blur(${(px * 0.1 * s).toFixed(1)}px)`; x.globalAlpha = 0.75; x.drawImage(gl, 0, 0);
  x.filter = 'none'; x.globalAlpha = 1;
  // extrusion
  setup(x);
  const steps = Math.ceil(Math.max(ext.dy, ext.dx) / Math.max(0.5, s));
  for (let i = steps; i >= 1; i--) {
    const k = i / steps;
    const col = `rgb(${Math.round(K.lerp(120, 34, k))},${Math.round(K.lerp(20, 3, k))},${Math.round(K.lerp(6, 0, k))})`;
    x.fillStyle = x.strokeStyle = col; x.lineWidth = ow;
    x.strokeText(text, ext.dx * k, ext.dy * k); x.fillText(text, ext.dx * k, ext.dy * k);
  }
  // outlines
  x.lineWidth = ow; x.strokeStyle = '#150100'; x.strokeText(text, 0, 0);
  x.lineWidth = ow * 0.58;
  x.strokeStyle = K.linGrad(x, 0, top, 0, bot, pal.rim);
  x.strokeText(text, 0, 0);
  x.lineWidth = ow * 0.26; x.strokeStyle = '#3a0700'; x.strokeText(text, 0, 0);
  // fill + bevel on its own layer
  const fl = K.makeCanvas(W, H), f = fl.getContext('2d');
  setup(f);
  f.fillStyle = K.linGrad(f, 0, top, 0, bot, pal.fill);
  f.fillText(text, 0, 0);
  const bev = px * 0.035 * s;
  const edge = (dy, col, blur) => {
    const e = K.makeCanvas(W, H), ec = e.getContext('2d');
    setup(ec); ec.fillStyle = col; ec.fillText(text, 0, 0);
    ec.globalCompositeOperation = 'destination-out'; ec.fillText(text, 0, dy);
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop';
    f.filter = `blur(${blur.toFixed(1)}px)`; f.drawImage(e, 0, 0); f.filter = 'none';
  };
  edge(bev * 1.4, 'rgba(255,255,240,0.95)', bev * 0.4);
  edge(-bev * 1.6, 'rgba(90,8,0,0.8)', bev * 0.5);
  f.globalCompositeOperation = 'source-over';
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(fl, 0, 0);
  // fill-only mask (for the glint)
  const mk = K.makeCanvas(W, H), mc = mk.getContext('2d');
  setup(mc); mc.fillStyle = '#fff'; mc.fillText(text, 0, 0);
  return { c, mask: mk, W, H, bx, by, asc, tw };
}

function pill(c, x, y, w, h) { c.beginPath(); rr(c, x, y, w, h, h / 2); }

/* ------------------------------------------------------------------ screen */

export function create(w, h) {
  const s = w / 1280;
  const LX = 0, LW = Math.ceil(700 * s), BX = 600, BW = w - Math.floor(600 * s);
  const lean = litFigure(LW, h, s, LX, leanParts(), {
    base: (c) => K.linGrad(c, 0, 100, 0, 720, [[0, '#140504'], [1, '#090202']]),
    lights: [
      { dx: -0.8, dy: -0.6, color: '#ff3c0c', hot: '#ff9a50', a: 1, thin: 6, wide: 26 },
      { dx: 0.96, dy: -0.28, color: '#ffb040', hot: '#ffe6a8', a: 0.85, thin: 2.4, wide: 12 },
    ],
    under: 'rgba(255,80,20,0.16)',
  });
  const brute = litFigure(BW, h, s, BX, bruteParts(), {
    base: (c) => K.linGrad(c, 0, 60, 0, 720, [[0, '#0a0a14'], [1, '#050509']]),
    lights: [
      { dx: 0.8, dy: -0.6, color: '#1a7dff', hot: '#8fd8ff', a: 1, thin: 6, wide: 28 },
      { dx: -0.96, dy: -0.28, color: '#ff8030', hot: '#ffd49a', a: 0.8, thin: 2.4, wide: 12 },
    ],
    under: 'rgba(255,90,30,0.12)',
  });

  const flames = [11, 23, 37].map((sd) => flameStrip(w, s, sd));
  const fire = [3, 5, 8, 13].map((sd) => fistFire(s, sd));
  const ember = glowSprite(12 * s, [[0, 'rgba(255,246,200,1)'], [0.25, 'rgba(255,170,60,0.85)'], [1, 'rgba(255,60,0,0)']]);
  const emberSizes = [0.45, 0.7, 0.95, 1.2].map((k) => { // pre-sized so the per-frame blits are unscaled
    const c = K.makeCanvas(ember.width * k, ember.height * k); c.getContext('2d').drawImage(ember, 0, 0, c.width, c.height); return c;
  });
  const burst = glowSprite(260 * s, [[0, 'rgba(255,250,225,0.95)'], [0.12, 'rgba(255,214,120,0.75)'],
    [0.4, 'rgba(255,120,30,0.28)'], [1, 'rgba(255,60,0,0)']]);
  const softRing = glowSprite(200 * s, [[0, 'rgba(255,200,120,0)'], [0.72, 'rgba(255,200,120,0)'], [0.86, 'rgba(255,226,170,0.85)'],
    [0.93, 'rgba(255,170,80,0.35)'], [1, 'rgba(255,120,40,0)']]);
  const spark = glowSprite(40 * s, [[0, 'rgba(220,245,255,1)'], [0.3, 'rgba(80,180,255,0.6)'], [1, 'rgba(30,90,255,0)']]);

  // BLAZING: white-hot gold chrome; FISTS: fire metal with a hard chrome horizon
  const L1 = logoLine('BLAZING', 104, s, 0.16, {
    fill: [[0, '#ffffff'], [0.3, '#fff6cf'], [0.48, '#ffe27a'], [0.52, '#ffb52e'], [0.78, '#ff9a1e'], [1, '#ffd760']],
    rim: [[0, '#fff6d8'], [0.5, '#ff7a1a'], [1, '#ffc24a']],
  });
  const L2 = logoLine('FISTS', 190, s, 0.16, {
    fill: [[0, '#fffbe6'], [0.2, '#ffe486'], [0.45, '#ffab2c'], [0.5, '#c4340c'], [0.56, '#a8220a'], [0.78, '#f06a18'], [1, '#ffc23a']],
    rim: [[0, '#fff3c4'], [0.45, '#ffc44a'], [0.55, '#b4500c'], [1, '#ffd36a']],
  });
  // logo placement (design units, centres)
  const logoCX = 640, l1Y = 370, l2Y = 520; // baselines

  // PRESS START + 1P VS 2P
  const press = (() => {
    const c = K.makeCanvas(560 * s, 70 * s), x = c.getContext('2d');
    x.font = K.font(400, 30 * s, 'Press Start 2P'); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.fillStyle = 'rgba(40,0,0,0.85)'; x.fillText('PRESS START', c.width / 2 + 4 * s, c.height / 2 + 5 * s);
    x.strokeStyle = '#2a0300'; x.lineWidth = 9 * s; x.strokeText('PRESS START', c.width / 2, c.height / 2);
    x.fillStyle = K.linGrad(x, 0, c.height / 2 - 15 * s, 0, c.height / 2 + 15 * s, [[0, '#fffbe0'], [0.5, '#ffd25a'], [1, '#ff9a24']]);
    x.fillText('PRESS START', c.width / 2, c.height / 2);
    return c;
  })();
  const badge = (() => {
    const c = K.makeCanvas(330 * s, 50 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    const tag = (cx, label, c1, c2) => {
      x.save(); x.translate(cx, 25); x.transform(1, 0, -0.2, 1, 0, 0);
      pill(x, 0, 0, 92, 36);
      x.fillStyle = K.linGrad(x, 0, -18, 0, 18, [[0, c1], [1, c2]]); x.fill();
      x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.75)'; x.stroke();
      x.font = K.font(400, 22, 'Bungee'); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#fff'; x.fillText(label, 0, 2);
      x.restore();
    };
    tag(62, '1P', '#ff7a2a', '#c21c0a');
    tag(268, '2P', '#4cc4ff', '#1450d8');
    x.font = K.font(400, 30, 'Bungee'); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.save(); x.translate(165, 26); x.transform(1, 0, -0.2, 1, 0, 0);
    x.lineWidth = 6; x.strokeStyle = '#2a0300'; x.strokeText('VS', 0, 0);
    x.fillStyle = K.linGrad(x, 0, -14, 0, 14, [[0, '#fffbe0'], [0.5, '#ffcf4a'], [1, '#ff8a1a']]);
    x.fillText('VS', 0, 0);
    x.restore();
    return c;
  })();
  const glintTmp = K.makeCanvas(Math.max(L1.W, L2.W), Math.max(L1.H, L2.H));

  // embers: fixed per-particle parameters
  const R = K.rng(99);
  const embers = Array.from({ length: 70 }, () => ({
    x: R() * 1280, sp: 40 + R() * 90, ph: R() * 10, amp: 10 + R() * 30, f: 0.6 + R() * 1.4, sz: 0.35 + R() * 0.9, off: R(),
  }));

  return {
    bg(ctx) {
      // fiery backdrop, brightest behind the clash
      ctx.fillStyle = K.radGrad(ctx, 650 * s, 250 * s, 0, 820 * s, [[0, '#ffd88a'], [0.07, '#ff9a2e'], [0.22, '#e2470e'],
        [0.45, '#8c140a'], [0.72, '#3c0508'], [1, '#160204']]);
      ctx.fillRect(0, 0, w, h);
      // rays
      {
        const rc = K.makeCanvas(w, h), r = rc.getContext('2d');
        K.rays(r, 650 * s, 250 * s, 40, 1400 * s, 'rgba(255,190,90,0.10)', 'rgba(255,90,20,0.0)', 0.05);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${(3 * s).toFixed(1)}px)`;
        ctx.drawImage(rc, 0, 0); ctx.restore();
      }
      // smoke banks at the top and sides
      {
        const sc = K.makeCanvas(w, h), x = sc.getContext('2d');
        const r = K.rng(5);
        for (let i = 0; i < 60; i++) {
          const side = i % 3;
          const px = side === 0 ? r() * 1280 : side === 1 ? r() * 260 : 1020 + r() * 260;
          const py = side === 0 ? r() * 120 - 20 : 80 + r() * 520;
          const pr = 50 + r() * 110;
          x.fillStyle = K.radGrad(x, px * s, py * s, 0, pr * s, [[0, 'rgba(26,4,6,0.55)'], [1, 'rgba(26,4,6,0)']]);
          x.beginPath(); x.arc(px * s, py * s, pr * s, 0, K.TAU); x.fill();
        }
        ctx.drawImage(sc, 0, 0);
      }
      // bottom heat
      ctx.fillStyle = K.linGrad(ctx, 0, 470 * s, 0, h, [[0, 'rgba(255,90,20,0)'], [1, 'rgba(255,110,30,0.45)']]);
      ctx.fillRect(0, 0, w, h);
      // fighters with their light bleed
      ctx.drawImage(lean.fig, LX * s, 0);
      ctx.drawImage(brute.fig, BX * s, 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(lean.glow, LX * s, 0); ctx.drawImage(brute.glow, BX * s, 0);
      ctx.restore();
      // static flames + vignette + grain
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
      ctx.drawImage(flames[0], 0, h - flames[0].height); ctx.restore();
      K.vignette(ctx, w, h, 0.6, '20,0,2');
      K.grain(ctx, w, h, 0.05, 17);
    },
    fg(ctx, t) {
      // living flames along the bottom
      const fp = t * 5, fi = Math.floor(fp), ff = fp - fi;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fa = flames[(fi + 1) % 3], fb = flames[(fi + 2) % 3];
      ctx.globalAlpha = 0.6 * (1 - ff); ctx.drawImage(fa, 0, h - fa.height);
      ctx.globalAlpha = 0.6 * ff; ctx.drawImage(fb, 0, h - fb.height);
      // the clash glow, pulsing
      const pulse = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);
      ctx.globalAlpha = 0.7 * pulse;
      ctx.drawImage(burst, Math.round(650 * s - burst.width / 2), Math.round(250 * s - burst.height / 2));
      // burning fists (lean fighter)
      const fr = Math.floor(t * 14);
      for (const [fx, fy, k] of [[586, 262, 0], [372, 300, 1]]) {
        const sp = fire[(fr + k * 2) % 4];
        ctx.globalAlpha = 0.95;
        ctx.drawImage(sp, Math.round((fx - 80) * s), Math.round((fy - 140) * s));
      }
      // crackling fists (brute)
      ctx.globalAlpha = 1;
      const step = Math.floor(t * 18);
      for (const [fx, fy, k] of [[740, 290, 0], [1076, 488, 1]]) {
        ctx.globalAlpha = 0.5 + 0.3 * K.hash(step, k + 7);
        ctx.drawImage(spark, (fx - 40) * s, (fy - 40) * s);
        for (let a = 0; a < 3; a++) {
          const seed = step * 13 + a * 5 + k * 101;
          const ang = K.hash(seed, 1) * K.TAU, len = (40 + K.hash(seed, 2) * 50) * s;
          const x0 = fx * s + Math.cos(ang) * 30 * s, y0 = fy * s + Math.sin(ang) * 30 * s;
          const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
          const pts = [[x0, y0]];
          for (let i = 1; i < 7; i++) {
            const u = i / 7, j = (K.hash(seed, i + 3) - 0.5) * 22 * s;
            pts.push([K.lerp(x0, x1, u) - Math.sin(ang) * j, K.lerp(y0, y1, u) + Math.cos(ang) * j]);
          }
          pts.push([x1, y1]);
          for (const [lw, col] of [[6 * s, 'rgba(60,150,255,0.35)'], [2 * s, 'rgba(225,245,255,0.95)']]) {
            ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round';
            ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
          }
        }
      }
      // the brute's eyes burning in the hood's shadow
      ctx.globalCompositeOperation = 'lighter';
      const eyeA = 0.75 + 0.25 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 2);
      for (const [ex, ey] of [[944, 170], [972, 172]]) {
        ctx.globalAlpha = eyeA; ctx.drawImage(spark, (ex - 20) * s, (ey - 20) * s, 40 * s, 40 * s);
        ctx.globalAlpha = 1; ctx.fillStyle = '#e8f8ff';
        ctx.beginPath(); ctx.ellipse(ex * s, ey * s, 7 * s, 2.6 * s, 0.12, 0, K.TAU); ctx.fill();
      }
      ctx.restore();

      // logo: BLAZING slides in, FISTS slams down; flash + shockwave on impact
      const impact = 0.38;
      const aIn = K.easeOutBack((t - 0.36) / 0.16, 1.4);
      const slam = K.clamp((t - 0.18) / (impact - 0.18));
      const settle = K.clamp((t - impact) / 0.22);
      const shake = t > impact && t < impact + 0.25 ? (1 - (t - impact) / 0.25) * 9 * s : 0;
      const sx = shake * (K.hash(Math.floor(t * 60), 3) - 0.5) * 2, sy = shake * (K.hash(Math.floor(t * 60), 4) - 0.5) * 2;
      if (aIn > 0) {
        ctx.save();
        ctx.globalAlpha = K.clamp(aIn * 2);
        const lx = (logoCX - (1 - aIn) * 760) * s - (L1.bx + L1.tw / 2) + sx;
        if (aIn < 0.9) { // motion smear while it whips in
          ctx.globalAlpha = 0.25; ctx.drawImage(L1.c, lx - 70 * s, l1Y * s - L1.by + sy);
          ctx.globalAlpha = 0.45; ctx.drawImage(L1.c, lx - 35 * s, l1Y * s - L1.by + sy);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(L1.c, Math.round(lx), Math.round(l1Y * s - L1.by + sy));
        ctx.restore();
      }
      if (slam > 0) {
        const sc = t < impact ? K.lerp(2.6, 1, K.easeInCubic(slam)) : settle >= 1 ? 1 : 1 + 0.06 * Math.sin(settle * Math.PI) * (1 - settle);
        if (sc === 1 && !shake) {
          ctx.drawImage(L2.c, Math.round(logoCX * s - (L2.bx + L2.tw / 2)), Math.round(l2Y * s - L2.by));
        } else {
          ctx.save();
          ctx.globalAlpha = K.clamp(slam * 2.5);
          ctx.translate(logoCX * s + sx, (l2Y - 70) * s + sy);
          ctx.scale(sc, sc);
          ctx.drawImage(L2.c, -(L2.bx + L2.tw / 2), 70 * s - L2.by);
          ctx.restore();
        }
      }
      if (t > impact && t < impact + 0.6) {
        const k = (t - impact) / 0.6, ek = K.easeOutCubic(k);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.pow(1 - K.clamp(k * 2.5), 2) * 0.22; ctx.fillStyle = '#ffcf8a'; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = Math.pow(1 - k, 1.5) * 0.9;
        const rw = (380 + 640 * ek) * s, rh = (130 + 200 * ek) * s;
        ctx.drawImage(softRing, logoCX * s - rw, 455 * s - rh, rw * 2, rh * 2);
        ctx.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * K.TAU + K.hash(i, 9) * 0.25, sp = 0.6 + K.hash(i, 10) * 0.6;
          const r0 = (420 + 560 * ek * sp), r1 = r0 + (40 + 70 * (1 - k)) * sp;
          ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = i % 3 ? '#ffd27a' : '#fff4d8'; ctx.lineWidth = (3.5 * (1 - k) + 1) * s;
          ctx.beginPath();
          ctx.moveTo((logoCX + Math.cos(a) * r0) * s, (455 + Math.sin(a) * r0 * 0.42) * s);
          ctx.lineTo((logoCX + Math.cos(a) * r1) * s, (455 + Math.sin(a) * r1 * 0.42) * s);
          ctx.stroke();
        }
        ctx.restore();
      }
      // glint sweep across the logo every 3.2 s
      const gp = ((t - 1.0) % 3.2) / 0.55;
      if (t > 1.0 && gp < 1) {
        for (const L of [L1, L2]) {
          const g = glintTmp.getContext('2d');
          g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, glintTmp.width, glintTmp.height);
          g.drawImage(L.mask, 0, 0);
          g.globalCompositeOperation = 'source-in';
          const gx = K.lerp(-0.3, 1.3, gp) * L.W;
          g.fillStyle = K.linGrad(g, gx - 60 * s, 0, gx + 60 * s, L.H * 0.4, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,240,0.85)'], [1, 'rgba(255,255,255,0)']]);
          g.fillRect(0, 0, L.W, L.H);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const y = L === L1 ? l1Y : l2Y;
          ctx.drawImage(glintTmp, logoCX * s - (L.bx + L.tw / 2), y * s - L.by);
          ctx.restore();
        }
      }
      // embers
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const span = 820;
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        const yy = 760 - (((t + e.ph) * e.sp + e.off * span) % span);
        const xx = e.x + Math.sin((t + e.ph) * e.f) * e.amp;
        const fl = 0.55 + 0.45 * Math.sin(t * 9 + i * 1.7);
        ctx.globalAlpha = K.clamp(fl * K.clamp((yy + 40) / 300));
        const sp = emberSizes[Math.min(3, Math.floor(e.sz * 3.2))];
        ctx.drawImage(sp, Math.round(xx * s - sp.width / 2), Math.round(yy * s - sp.height / 2));
      }
      ctx.restore();
      // UI
      const ui = K.easeOutCubic((t - 0.62) / 0.4);
      if (ui > 0) {
        ctx.save();
        ctx.globalAlpha = ui;
        ctx.drawImage(badge, Math.round(640 * s - badge.width / 2), Math.round((668 + (1 - ui) * 30) * s - badge.height / 2));
        if (t < 1.1 || K.blinkOn(t - 1.1, 1.25, 0.66)) ctx.drawImage(press, Math.round(640 * s - press.width / 2), Math.round(612 * s - press.height / 2));
        ctx.restore();
      }
    },
  };
}
