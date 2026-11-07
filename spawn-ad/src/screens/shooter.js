// TASK FORCE ZERO: a made-up modern military shooter's loading screen.
// A three-soldier squad walks out of a burning dawn (backlit, rim-lit orange), helicopters overhead,
// smoke haze over a ruined skyline. Stencil logo with an orange slashed zero, mission card, loading bar.
import * as K from './kit.js';

export const meta = { id: 'shooter', title: 'TASK FORCE ZERO', aspect: 16 / 9 };

/* ------------------------------------------------------------------ path helpers (design units) */

function spline(c, pts, closed = true) {
  const n = pts.length;
  if (closed) { // clockwise, so overlapping shapes union under nonzero fill
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
function rr(c, cx, cy, w, h, r, rot = 0) {
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  const pts = [[x0 + r, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0], [x0, y0, x1, y0]];
  const p = P(pts[0][0], pts[0][1]);
  c.moveTo(p[0], p[1]);
  for (let i = 1; i < pts.length; i++) {
    const a = P(pts[i][0], pts[i][1]), b = P(pts[i][2], pts[i][3]);
    c.arcTo(a[0], a[1], b[0], b[1], r);
  }
  c.closePath();
}
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

/* ------------------------------------------------------------------ lit silhouettes */

// Parts back to front, dark, each with a faint directional rim; then a hot rim on the whole silhouette.
function litFigure(fullW, fullH, s, parts, look) {
  // canvases cover just this figure's bounds (+ room for the glow); (OX, OY) is their design-space origin
  const U = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of parts) { const b = pathBounds(p.path); U.x0 = Math.min(U.x0, b.x0); U.y0 = Math.min(U.y0, b.y0); U.x1 = Math.max(U.x1, b.x1); U.y1 = Math.max(U.y1, b.y1); }
  const OX = Math.max(0, Math.floor(U.x0 - 50)), OY = Math.max(0, Math.floor(U.y0 - 50));
  const W = Math.min(fullW, Math.ceil((Math.min(1280, U.x1 + 50) - OX) * s)), H = Math.min(fullH, Math.ceil((Math.min(720, U.y1 + 50) - OY) * s));
  const fig = K.makeCanvas(W, H), f = fig.getContext('2d');
  const tmp = K.makeCanvas(W, H), t = tmp.getContext('2d');
  const band = K.makeCanvas(W, H), b = band.getContext('2d');
  const xf = (c, dx = 0, dy = 0) => c.setTransform(s, 0, 0, s, (dx - OX) * s, (dy - OY) * s);
  const id = (c) => c.setTransform(1, 0, 0, 1, 0, 0);
  for (const part of parts) {
    const bb = pathBounds(part.path), pad = 24 * s;
    const rx = Math.max(0, Math.floor((bb.x0 - OX) * s - pad)), ry = Math.max(0, Math.floor((bb.y0 - OY) * s - pad));
    const rw = Math.min(W, Math.ceil((bb.x1 - OX) * s + pad)) - rx, rh = Math.min(H, Math.ceil((bb.y1 - OY) * s + pad)) - ry;
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
      const e = (part.edge ?? 0.3) * L.a;
      if (e <= 0.01) continue;
      crescent(L, L.thin * 0.6, L.color);
      id(t); t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.45 * e; blit(t, band);
      t.globalAlpha = 1;
    }
    id(t); t.globalCompositeOperation = 'source-over';
    blit(f, tmp);
  }
  const glow = K.makeCanvas(W, H), g = glow.getContext('2d');
  const mask = (dx, dy, color) => {
    id(b); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H);
    b.drawImage(fig, 0, 0);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = color; b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'destination-out'; b.drawImage(fig, -dx * s, -dy * s);
    b.globalCompositeOperation = 'source-over';
  };
  const lit = K.makeCanvas(W, H), l = lit.getContext('2d');
  for (const L of look.lights) {
    mask(L.dx * L.wide, L.dy * L.wide, L.color);
    l.globalAlpha = 0.45 * L.a; l.filter = `blur(${(L.wide * 0.45 * s).toFixed(1)}px)`; l.drawImage(band, 0, 0);
    l.filter = 'none';
    mask(L.dx * L.thin, L.dy * L.thin, L.hot || L.color);
    l.globalAlpha = L.a; l.drawImage(band, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.filter = `blur(${(4 * s).toFixed(1)}px)`; g.globalAlpha = 0.45 * L.a; g.drawImage(band, 0, 0);
    g.filter = `blur(${(14 * s).toFixed(1)}px)`; g.globalAlpha = 0.25 * L.a; g.drawImage(band, 0, 0);
    g.filter = 'none'; g.globalAlpha = 1;
  }
  l.globalAlpha = 1; l.globalCompositeOperation = 'destination-in'; l.drawImage(fig, 0, 0);
  if (look.fade) { // rim light dies out toward the ground
    const fm = K.linGrad(l, 0, (look.fade[0] - OY) * s, 0, (look.fade[1] - OY) * s, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0.12)']]);
    l.fillStyle = fm; l.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = fm; g.fillRect(0, 0, W, H);
  }
  f.drawImage(lit, 0, 0);
  return { fig, glow, x: Math.round(OX * s), y: Math.round(OY * s) };
}

/* ------------------------------------------------------------------ the squad */

// Local drawing frame for one figure: local units (helmet top y=0), scale k, optional mirror.
function frame(X, Y, k, flip) {
  const fl = flip ? -1 : 1;
  const P = (x, y) => [X + x * k * fl, Y + y * k];
  const poly = (c, pts, sharp = false) => spline(c, pts.map(([x, y, cn]) => ((cn || sharp) ? [...P(x, y), 1] : P(x, y))));
  const E = (c, x, y, rx, ry, rot = 0) => { const [px, py] = P(x, y); ell(c, px, py, rx * k, ry * k, rot * fl); };
  const R = (c, x, y, w, h, r, rot = 0) => { const [px, py] = P(x, y); rr(c, px, py, w * k, h * k, r * k, rot * fl); };
  const C = (c, x1, y1, r1, x2, y2, r2) => { const [a, b] = P(x1, y1), [d, e] = P(x2, y2); capsule(c, a, b, r1 * k, d, e, r2 * k); };
  // carbine: butt at (bx, by), barrel direction ang (local), magazine on the screen-down side
  const gun = (bx, by, ang, rk = 1) => {
    const rc = Math.cos(ang), rs = Math.sin(ang), fw = rc < 0 ? -1 : 1;
    const Q = (u, w) => [bx + (u * rc - w * fw * rs) * rk, by + (u * rs + w * fw * rc) * rk];
    const rq = (c, pts) => poly(c, pts.map(([u, w]) => Q(u, w)), true);
    const path = (c) => {
      rq(c, [[0, -11], [44, -9], [46, 10], [2, 14]]); // stock
      rq(c, [[40, -10], [126, -10], [126, 11], [40, 11]]); // receiver
      rq(c, [[66, -10], [72, -25], [106, -25], [112, -10]]); // optic
      rq(c, [[94, 10], [112, 10], [126, 54], [106, 58]]); // magazine
      rq(c, [[56, 10], [70, 10], [64, 38], [50, 38]]); // grip
      rq(c, [[124, -9], [216, -8], [216, 9], [124, 10]]); // handguard
      rq(c, [[160, 8], [172, 8], [170, 34], [158, 34]]); // foregrip
      rq(c, [[214, -5], [276, -5], [276, 5], [214, 5]]); // suppressor
    };
    return { path, grip: Q(62, 30), fore: Q(166, 30) };
  };
  return { P, poly, E, R, C, gun };
}

// Squad leader, facing the camera mid-stride, carbine at high port: the muzzle rises past his left
// shoulder so the rifle reads against the sky.
function leader(X, Y, k) {
  const { P, poly, E, R, C, gun } = frame(X, Y, k, false);
  const g = gun(72, 300, -2.285, 1.2);
  return { strobe: P(-24, 4), parts: [
    { path: (c) => { // legs mid-stride, boots
      C(c, 44, 350, 42, 56, 486, 30); C(c, 56, 486, 30, 62, 636, 23); R(c, 68, 646, 50, 26, 8);
      C(c, -44, 350, 42, -60, 500, 31); C(c, -60, 500, 31, -66, 660, 24); R(c, -70, 672, 52, 26, 8);
      E(c, 57, 486, 30, 23); E(c, -61, 500, 32, 25);
    }, edge: 0.2 },
    { path: (c) => { poly(c, [[-80, 318], [80, 318], [88, 396], [-88, 396]]); R(c, 90, 370, 28, 56, 6); R(c, -92, 356, 26, 46, 6); }, edge: 0.15 },
    { path: (c) => poly(c, [ // torso + plate carrier, tapering to the waist
      [-36, 114], [36, 114], [70, 121], [92, 136], [99, 170], [92, 226], [82, 282], [78, 338], [-78, 338], [-82, 282],
      [-92, 226], [-99, 170], [-92, 136], [-70, 121]]), edge: 0.15 },
    { path: (c) => { R(c, -94, 240, 20, 56, 6); for (const x of [-42, 0, 42]) R(c, x, 284, 36, 46, 6); poly(c, [[-80, 308], [80, 308], [82, 332], [-82, 332]], true); }, edge: 0.2 },
    { path: (c) => poly(c, [[-30, 96], [30, 96], [44, 132], [-44, 132]]), edge: 0.15 },
    { path: (c) => poly(c, [[-34, 52], [34, 52], [35, 86], [23, 106], [0, 113], [-23, 106], [-35, 86]]), edge: 0.25 },
    { path: (c) => { E(c, 42, 76, 15, 21); E(c, -42, 76, 15, 21); }, edge: 0.35 },
    { path: (c) => { // helmet, rails, NVG mount, rail light
      poly(c, [[-52, 60], [-55, 34], [-46, 11], [-24, 0], [0, -3], [24, 0], [46, 11], [55, 34], [52, 60], [41, 64], [-41, 64]]);
      R(c, 56, 34, 11, 28, 2); R(c, -56, 34, 11, 28, 2); R(c, 0, 7, 30, 13, 3); R(c, 73, 34, 24, 12, 4);
    }, edge: 0.45 },
    { path: (c) => { E(c, 96, 156, 27, 31); C(c, 98, 160, 25, 124, 252, 21); E(c, -96, 156, 27, 31); C(c, -98, 160, 25, -134, 236, 21); }, edge: 0.25 },
    { path: g.path, edge: 0.55 },
    { path: (c) => {
      C(c, 124, 252, 21, g.grip[0], g.grip[1], 15); C(c, -134, 236, 21, g.fore[0], g.fore[1], 15);
      E(c, g.grip[0], g.grip[1], 16, 14); E(c, g.fore[0], g.fore[1], 16, 14);
    }, edge: 0.4 },
  ] };
}

// Rifleman in profile (faces left unless flipped), carbine shouldered and aimed.
function aimer(X, Y, k, flip) {
  const { P, poly, E, R, C, gun } = frame(X, Y, k, flip);
  const g = gun(-18, 96, Math.PI - 0.08, 1.05);
  return { strobe: P(-50, 0), parts: [
    { path: (c) => { // legs, planted wide
      C(c, 26, 330, 36, 46, 470, 28); C(c, 46, 470, 28, 64, 626, 22); R(c, 58, 634, 54, 22, 7);
      C(c, -22, 330, 36, -50, 468, 28); C(c, -50, 468, 28, -70, 628, 22); R(c, -84, 636, 54, 22, 7);
      E(c, -52, 470, 22, 27);
    }, edge: 0.25 },
    { path: (c) => poly(c, [[34, 118], [74, 126], [82, 252], [42, 264]]), edge: 0.3 }, // assault pack
    { path: (c) => C(c, -12, 134, 26, -112, 196, 19), edge: 0.2 }, // far (support) upper arm
    { path: (c) => C(c, -112, 196, 19, ...g.fore, 14), edge: 0.2 },
    { path: (c) => poly(c, [ // torso, leaning into the shot
      [-44, 116], [20, 106], [52, 120], [60, 180], [58, 262], [52, 326], [-42, 330], [-58, 284], [-64, 204], [-58, 146]]), edge: 0.2 },
    { path: (c) => { R(c, -64, 236, 20, 76, 5); poly(c, [[-50, 300], [56, 300], [58, 326], [-50, 330]], true); }, edge: 0.25 },
    { path: (c) => poly(c, [[-26, 92], [16, 88], [24, 122], [-34, 124]]), edge: 0.2 }, // neck
    { path: (c) => poly(c, [ // face pressed to the stock
      [-38, 46], [-42, 60], [-52, 70, 1], [-44, 78], [-46, 90, 1], [-30, 100], [8, 102], [22, 62]]), edge: 0.35 },
    { path: (c) => E(c, 4, 66, 14, 18), edge: 0.3 },
    { path: (c) => { // helmet in profile with NVG mount and counterweight
      poly(c, [[-46, 46], [-48, 26], [-36, 8], [-12, -2], [14, -2], [38, 8], [50, 28], [54, 52], [40, 58], [8, 52], [-30, 50]]);
      R(c, -50, 20, 14, 18, 3); R(c, -52, 2, 15, 26, 4, 0.3); R(c, 50, 30, 14, 22, 3);
    }, edge: 0.5 },
    { path: g.path, edge: 0.5 },
    { path: (c) => { C(c, 6, 132, 27, -18, 198, 21); C(c, -18, 198, 21, ...g.grip, 15); E(c, g.grip[0], g.grip[1], 16, 14); }, edge: 0.3 },
  ] };
}

// Radioman in profile (faces left unless flipped): carbine low, antenna whipping up off the pack.
function radioman(X, Y, k, flip) {
  const { P, poly, E, R, C, gun } = frame(X, Y, k, flip);
  const g = gun(-20, 150, Math.PI - 0.62, 1.0);
  return { strobe: P(66, -150), parts: [
    { path: (c) => { C(c, 52, 126, 2.4, 70, -150, 1.6); E(c, 70, -152, 3.5, 3.5); }, edge: 0.6 }, // antenna
    { path: (c) => { // walking legs
      C(c, 22, 330, 36, 58, 462, 28); C(c, 58, 462, 28, 76, 618, 22); R(c, 72, 628, 54, 22, 7);
      C(c, -20, 330, 36, -36, 470, 28); C(c, -36, 470, 28, -44, 630, 22); R(c, -58, 638, 54, 22, 7);
      E(c, -38, 472, 22, 27);
    }, edge: 0.25 },
    { path: (c) => poly(c, [[28, 104], [84, 112], [96, 270], [40, 280]]), edge: 0.3 }, // radio pack
    { path: (c) => poly(c, [
      [-40, 116], [22, 106], [52, 120], [58, 180], [56, 262], [50, 326], [-42, 330], [-56, 284], [-60, 204], [-54, 146]]), edge: 0.2 },
    { path: (c) => { R(c, -60, 236, 20, 76, 5); poly(c, [[-50, 300], [56, 300], [58, 326], [-50, 330]], true); }, edge: 0.25 },
    { path: (c) => poly(c, [[-26, 92], [16, 88], [24, 122], [-34, 124]]), edge: 0.2 },
    { path: (c) => poly(c, [[-36, 46], [-38, 60], [-48, 72, 1], [-40, 80], [-42, 92, 1], [-28, 102], [8, 102], [22, 62]]), edge: 0.35 },
    { path: (c) => E(c, 4, 66, 14, 18), edge: 0.3 },
    { path: (c) => { poly(c, [[-46, 46], [-48, 26], [-36, 8], [-12, -2], [14, -2], [38, 8], [50, 28], [54, 52], [40, 58], [8, 52], [-30, 50]]);
      R(c, -50, 20, 14, 18, 3); R(c, 50, 30, 14, 22, 3); }, edge: 0.5 },
    { path: g.path, edge: 0.5 },
    { path: (c) => { // both arms down to the carbine
      C(c, 0, 136, 27, -8, 232, 21); C(c, -8, 232, 21, ...g.grip, 15); E(c, g.grip[0], g.grip[1], 16, 14);
      C(c, -24, 140, 25, -70, 226, 20); C(c, -70, 226, 20, ...g.fore, 14); E(c, g.fore[0], g.fore[1], 15, 13);
    }, edge: 0.3 },
  ] };
}

/* ------------------------------------------------------------------ helicopter */

function heliPath(c, k) { // local: nose at x=0, belly y=60; centred later
  const P = (x, y) => [x * k, y * k];
  const poly = (pts) => spline(c, pts.map(([x, y, cn]) => (cn ? [...P(x, y), 1] : P(x, y))));
  poly([[4, 44], [12, 24], [34, 10], [70, 2], [128, 0], [150, 4], [168, 18], [300, 26], [302, 36], [168, 44], [150, 58], [70, 62], [24, 58]]);
  poly([[280, 28, 1], [294, -22, 1], [309, -22, 1], [306, 36, 1]]);
  poly([[80, 4, 1], [96, -12], [142, -12], [158, 6, 1]]);
  rr(c, ...P(118, -16), 8 * k, 16 * k, 2 * k);
  rr(c, ...P(284, 34), 46 * k, 6 * k, 2 * k);
  rr(c, ...P(98, 78), 156 * k, 5 * k, 2.5 * k);
  rr(c, ...P(62, 68), 5 * k, 20 * k, 1 * k); rr(c, ...P(134, 68), 5 * k, 20 * k, 1 * k);
}

function heliSprite(k, s, body, rim) {
  const W = 330 * k * s, H = 110 * k * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
  x.setTransform(s, 0, 0, s, 8 * k * s, 30 * k * s);
  x.beginPath(); heliPath(x, k); x.fillStyle = body; x.fill();
  // warm underlight on the belly edge
  x.setTransform(1, 0, 0, 1, 0, 0);
  const m = K.makeCanvas(W, H), mx = m.getContext('2d');
  mx.drawImage(c, 0, 0); mx.globalCompositeOperation = 'source-in'; mx.fillStyle = rim; mx.fillRect(0, 0, W, H);
  mx.globalCompositeOperation = 'destination-out'; mx.drawImage(c, 0, -2.2 * s * k);
  x.globalCompositeOperation = 'source-atop'; x.drawImage(m, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ texture */

function distress(ctx, W, H, seed, s, n, size = 1) {
  const r = K.rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = (0.45 + Math.pow(r(), 4) * 3.2) * s * size;
    ctx.globalAlpha = 0.35 + r() * 0.65;
    ctx.beginPath(); ctx.ellipse(x, y, rad * (1 + r() * 1.5), rad, r() * 3, 0, K.TAU); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < n / 40; i++) {
    const x = r() * W, y = r() * H, len = (10 + r() * 50) * s, a = -0.5 + r();
    ctx.globalAlpha = 0.15 + r() * 0.35; ctx.lineWidth = (0.4 + r() * 0.9) * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.restore();
}

function glowSprite(R, stops) {
  const c = K.makeCanvas(R * 2, R * 2), x = c.getContext('2d');
  x.fillStyle = K.radGrad(x, R, R, 0, R, stops);
  x.fillRect(0, 0, R * 2, R * 2);
  return c;
}

// Smoke plume: overlapping soft puffs rising and widening, lit from the fire at the base.
function plume(c, s, x0, y0, height, w0, w1, lean, seed, n = 80) {
  const r = K.rng(seed);
  for (let i = 0; i < n; i++) {
    const u = Math.pow(r(), 0.8);
    const wd = K.lerp(w0, w1, u);
    const x = x0 + lean * u * u * height + (r() - 0.5) * wd * 0.7, y = y0 - u * height;
    const rad = wd * (0.3 + r() * 0.35);
    const heat = Math.pow(1 - u, 4);
    const col = [Math.round(K.lerp(28, 160, heat)), Math.round(K.lerp(36, 74, heat)), Math.round(K.lerp(36, 30, heat))];
    const a = 0.42 + r() * 0.25;
    c.fillStyle = K.radGrad(c, x * s, y * s, 0, rad * s, [[0, `rgba(${col},${a})`], [1, `rgba(${col},0)`]]);
    c.fillRect((x - rad) * s, (y - rad) * s, rad * 2 * s, rad * 2 * s);
  }
}

/* ------------------------------------------------------------------ screen */

const OFFWHITE = '#ece8dc';
const ORANGE = '#ef7d2c';
const SUN = [946, 446];

export function create(w, h) {
  const s = w / 1280;

  // --- squad, back to front. Each is rim-lit from the low sun behind them; the sky adds a cool top edge.
  const toSun = (x, y) => { const dx = SUN[0] - x, dy = SUN[1] - 120 - y, d = Math.hypot(dx, dy); return [dx / d, dy / d]; };
  const squadDefs = [
    { f: aimer(770, 266, 0.66, false), cx: 770, haze: true },
    { f: radioman(1150, 262, 0.68, true), cx: 1150, haze: true },
    { f: leader(958, 176, 0.84), cx: 958, haze: false },
  ];
  const squadFigs = squadDefs.map((d) => {
    const lights = d.haze
      ? [{ dx: toSun(d.cx, 300)[0], dy: Math.min(-0.25, toSun(d.cx, 300)[1]), color: '#ff7f2a', hot: '#ffc788', a: 1, thin: 4, wide: 16 }]
      : [{ dx: -0.9, dy: -0.42, color: '#ff7f2a', hot: '#ffc788', a: 0.95, thin: 3.8, wide: 18 },
        { dx: 0.9, dy: -0.42, color: '#ff7f2a', hot: '#ffc788', a: 0.95, thin: 3.8, wide: 18 }];
    lights.push({ dx: 0, dy: -1, color: '#86b8ad', hot: '#c2e2d8', a: 0.4, thin: 2.2, wide: 8 });
    return litFigure(w, h, s, d.f.parts, {
      base: (c) => K.linGrad(c, 0, 150, 0, 720, d.haze ? [[0, '#2b302b'], [1, '#191b18']] : [[0, '#141816'], [1, '#0b0d0c']]),
      lights,
      fade: [500, 650],
    });
  });

  const heliA = heliSprite(0.78, s, '#1c2322', 'rgba(255,150,70,0.75)');
  const heliB = heliSprite(0.4, s, '#2e3633', 'rgba(255,160,80,0.6)');
  const heliC = heliSprite(0.22, s, '#3c443f', 'rgba(255,170,90,0.5)');
  const fireGlow = glowSprite(40 * s, [[0, 'rgba(255,220,150,0.9)'], [0.3, 'rgba(255,130,40,0.5)'], [1, 'rgba(255,60,0,0)']]);
  const ember = glowSprite(6 * s, [[0, 'rgba(255,230,170,1)'], [0.4, 'rgba(255,140,50,0.6)'], [1, 'rgba(255,80,0,0)']]);
  const beacon = glowSprite(9 * s, [[0, 'rgba(255,230,220,1)'], [0.3, 'rgba(255,60,50,0.8)'], [1, 'rgba(255,0,0,0)']]);
  const strobe = glowSprite(14 * s, [[0, 'rgba(230,255,255,1)'], [0.25, 'rgba(160,255,240,0.6)'], [1, 'rgba(80,255,220,0)']]);

  // drifting smoke haze (panned in fg), tiles horizontally
  const haze = K.makeCanvas(w, 360 * s);
  {
    const x = haze.getContext('2d'), r = K.rng(31);
    for (let i = 0; i < 46; i++) {
      const px = r() * 1280, py = 60 + r() * 240, pr = 60 + r() * 120;
      for (const dx of [-1280, 0, 1280]) {
        x.fillStyle = K.radGrad(x, (px + dx) * s, py * s, 0, pr * s, [[0, 'rgba(112,128,118,0.2)'], [1, 'rgba(112,128,118,0)']]);
        x.fillRect((px + dx - pr) * s, (py - pr) * s, pr * 2 * s, pr * 2 * s);
      }
    }
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = K.linGrad(x, 0, 0, 0, haze.height, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(0, 0, w, haze.height);
  }

  // --- logo: TASK FORCE spaced above a huge distressed ZERO with an orange slashed zero
  const LOGO_X = 70, ZERO_BASE = 420, ZERO_CAP = 178;
  const logo = (() => {
    const m = K.makeCanvas(4, 4).getContext('2d');
    m.font = K.font(400, 100, 'Anton');
    const capPer = m.measureText('Z').actualBoundingBoxAscent / 100;
    const px = ZERO_CAP / capPer;
    const W = 600 * s, H = 300 * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
    const zx = 16 * s, zb = 250 * s;
    const fZ = K.font(400, px * s, 'Anton');
    x.font = fZ;
    const adv = [...'ZER'].map((ch) => x.measureText(ch).width);
    const oW = x.measureText('O').width;
    const asc = ZERO_CAP * s;
    const zeroW = adv.reduce((a, b) => a + b, 0) + oW;
    const L = K.makeCanvas(W, H), l = L.getContext('2d');
    l.font = fZ; l.textBaseline = 'alphabetic';
    l.fillStyle = K.linGrad(l, 0, zb - asc, 0, zb, [[0, '#f6f3ea'], [0.55, '#e0dbcc'], [1, '#bfb9a8']]);
    l.fillText('ZERO', zx, zb);
    l.globalCompositeOperation = 'destination-out';
    const ox = zx + adv[0] + adv[1] + adv[2];
    l.fillRect(0, zb - asc * 0.585, W, 4.5 * s); // stencil slice through the word
    const ocx = ox + oW / 2, ocy = zb - asc / 2;
    l.save(); l.translate(ocx, ocy); l.rotate(-1.12); l.fillRect(-asc * 0.6, -12 * s, asc * 1.2, 24 * s); l.restore();
    l.globalCompositeOperation = 'source-atop';
    l.fillStyle = K.linGrad(l, 0, zb - asc, 0, zb, [[0, 'rgba(60,50,30,0)'], [1, 'rgba(60,50,30,0.22)']]);
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'source-over';
    distress(l, W, H, 7, s, 2600, 0.55);
    const S = K.makeCanvas(W, H), sx = S.getContext('2d');
    sx.translate(ocx, ocy); sx.rotate(-1.12);
    sx.fillStyle = K.linGrad(sx, 0, -8 * s, 0, 8 * s, [[0, '#ffb470'], [0.5, ORANGE], [1, '#c85a1c']]);
    sx.fillRect(-asc * 0.56, -8 * s, asc * 1.12, 16 * s);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    distress(sx, W, H, 9, s, 600, 0.5);
    const sh = K.makeCanvas(W, H), shx = sh.getContext('2d');
    shx.drawImage(L, 0, 0); shx.drawImage(S, 0, 0);
    shx.globalCompositeOperation = 'source-in'; shx.fillStyle = 'rgba(4,8,8,0.9)'; shx.fillRect(0, 0, W, H);
    x.filter = `blur(${(9 * s).toFixed(1)}px)`; x.globalAlpha = 0.8; x.drawImage(sh, 5 * s, 9 * s); x.filter = 'none';
    x.globalAlpha = 0.95; x.drawImage(sh, 2 * s, 4 * s); x.globalAlpha = 1;
    x.drawImage(L, 0, 0); x.drawImage(S, 0, 0);
    return { c, zx, zb, asc, zeroW, slash: S, letters: L };
  })();
  const tf = (() => {
    const W = 620 * s, H = 64 * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
    x.font = K.font(600, 44 * s, 'Teko'); x.textBaseline = 'alphabetic';
    const chars = [...'TASK FORCE'], ws = chars.map((ch) => x.measureText(ch).width);
    const raw = ws.reduce((a, b) => a + b, 0);
    const track = (logo.zeroW - raw - 4 * s) / (chars.length - 1);
    const draw = (ox, oy) => { let cx = 12 * s + ox; chars.forEach((ch, i) => { x.fillText(ch, cx, 48 * s + oy); cx += ws[i] + track; }); };
    x.fillStyle = 'rgba(4,8,8,0.85)'; draw(2 * s, 3 * s);
    x.fillStyle = OFFWHITE; draw(0, 0);
    const cap = x.measureText('T').actualBoundingBoxAscent;
    x.globalCompositeOperation = 'destination-out';
    x.fillRect(0, 48 * s - cap * 0.585, W, Math.max(1.5, 2.2 * s)); // same stencil slice as ZERO
    x.globalCompositeOperation = 'source-over';
    distress(x, W, H, 3, s, 260, 0.5);
    return { c };
  })();
  const TF_BASE = ZERO_BASE - ZERO_CAP - 16;
  const sweep = K.makeCanvas(logo.c.width, logo.c.height), sweepCtx = sweep.getContext('2d');

  // --- UI pieces
  const card = (() => {
    const W = 700 * s, H = 150 * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.fillStyle = ORANGE; x.fillRect(0, 4, 118, 24);
    x.font = K.font(700, 15, 'Chakra Petch'); x.fillStyle = '#16100a'; x.textBaseline = 'middle';
    K.spacedText(x, 'MISSION 07', 10, 17, 0.14, 'left');
    x.font = K.font(600, 60, 'Teko'); x.textBaseline = 'alphabetic';
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillText('OPERATION NIGHTFALL', 2, 84);
    x.fillStyle = OFFWHITE; x.fillText('OPERATION NIGHTFALL', 0, 82);
    x.font = K.font(600, 18, 'Chakra Petch'); x.fillStyle = '#a9bab2';
    K.spacedText(x, 'CINDER STRAIT  ·  04:12 LOCAL', 0, 110, 0.16, 'left');
    return c;
  })();
  const tip = (() => {
    const W = 760 * s, H = 30 * s, c = K.makeCanvas(W, H), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.font = K.font(700, 15, 'Chakra Petch'); x.fillStyle = ORANGE; x.textBaseline = 'middle';
    K.spacedText(x, 'TIP', 0, 15, 0.16, 'left');
    x.font = K.font(400, 16, 'Inter'); x.fillStyle = '#b8c2bc';
    x.fillText('Smoke blocks thermal optics. Push through it, not around it.', 44, 16);
    return c;
  })();
  const pressAny = (() => {
    const c = K.makeCanvas(330 * s, 34 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.font = K.font(700, 19, 'Chakra Petch'); x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,0.6)'; K.spacedText(x, 'PRESS ANY BUTTON', 331, 19, 0.2, 'right');
    x.fillStyle = OFFWHITE; K.spacedText(x, 'PRESS ANY BUTTON', 329, 17, 0.2, 'right');
    return c;
  })();
  const loadFont = K.font(700, 16 * s, 'Chakra Petch');

  // loading progress over ~3 s with a couple of stalls
  const KEYS = [[0.7, 0], [1.25, 0.27], [1.6, 0.33], [2.35, 0.7], [2.75, 0.75], [3.55, 1]];
  const progress = (t) => {
    if (t <= KEYS[0][0]) return 0;
    for (let i = 1; i < KEYS.length; i++) {
      const [t1, p1] = KEYS[i], [t0, p0] = KEYS[i - 1];
      if (t <= t1) return K.lerp(p0, p1, K.smooth(t0, t1, t));
    }
    return 1;
  };

  const R = K.rng(77);
  const ash = Array.from({ length: 60 }, () => ({ x: R() * 1400, y: R() * 720, sp: 8 + R() * 20, dr: 10 + R() * 25, ph: R() * 6, a: 0.25 + R() * 0.45, z: 0.8 + R() * 1.6 }));
  const sparks = Array.from({ length: 26 }, () => ({ x: 560 + R() * 720, sp: 18 + R() * 30, ph: R() * 20, amp: 6 + R() * 14 }));
  const fires = [[452, 478, 0.5], [612, 470, 0.9], [706, 476, 0.7], [820, 482, 0.8], [1060, 468, 1], [1210, 474, 0.8]];

  let squadOverlay = null; // the squad's final bg pixels, redrawn in fg over far-off effects
  const OV = { x: Math.floor(560 * s), y: Math.floor(140 * s) };
  return {
    bg(out) {
      const bgc = K.makeCanvas(w, h), ctx = bgc.getContext('2d');
      // dawn through smoke: dark teal above, olive haze, a burning band on the horizon
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, h, [[0, '#132a2d'], [0.16, '#224142'], [0.33, '#3f5c56'], [0.47, '#6b7258'],
        [0.565, '#a47a48'], [0.62, '#e48c3e'], [0.652, '#ffb862'], [0.675, '#d8722e'], [0.71, '#5c3020'], [0.8, '#1f1814'], [1, '#0b0b0a']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = K.radGrad(ctx, SUN[0] * s, SUN[1] * s, 0, 700 * s, [[0, 'rgba(255,170,80,0.6)'], [0.3, 'rgba(240,120,50,0.25)'], [1, 'rgba(200,80,30,0)']]);
      ctx.fillRect(0, 0, w, h);
      // smoke columns from the burning city (dark, lit from below)
      {
        const sc = K.makeCanvas(w, h), x = sc.getContext('2d');
        plume(x, s, 330, 476, 500, 50, 280, 0.32, 4, 110);
        plume(x, s, 640, 474, 400, 40, 210, 0.4, 8, 80);
        plume(x, s, 1190, 472, 520, 60, 300, 0.22, 12, 110);
        ctx.save(); ctx.filter = `blur(${(4 * s).toFixed(1)}px)`; ctx.drawImage(sc, 0, 0); ctx.restore();
      }
      // low sun, burning through the haze
      ctx.fillStyle = K.radGrad(ctx, SUN[0] * s, SUN[1] * s, 0, 120 * s, [[0, 'rgba(255,244,214,1)'], [0.22, 'rgba(255,226,170,0.9)'], [0.3, 'rgba(255,190,110,0.5)'], [1, 'rgba(255,150,70,0)']]);
      ctx.fillRect(0, 0, w, h);
      // far skyline (hazy) then near ruins (dark, a few lit windows, broken tops, masts)
      ctx.globalAlpha = 0.7;
      K.skyline(ctx, w, h, 486 * s, { seed: 21, minH: 8 * s, maxH: 44 * s, minW: 18 * s, maxW: 60 * s, fill: '#6e5a40' });
      ctx.globalAlpha = 1;
      {
        const r = K.rng(5);
        let x = -10;
        while (x < 1300) {
          const bw = 24 + r() * 64, tall = r() < 0.12, bh = tall ? 60 + r() * 50 : 8 + Math.pow(r(), 1.5) * 44;
          const top = 492 - bh;
          ctx.fillStyle = '#221f1a';
          ctx.beginPath(); ctx.moveTo(x * s, 520 * s); ctx.lineTo(x * s, top * s);
          if (r() < 0.45) {
            const n = 3 + Math.floor(r() * 3);
            for (let i = 1; i <= n; i++) ctx.lineTo((x + (bw * i) / n) * s, (top + r() * 16) * s);
          } else ctx.lineTo((x + bw) * s, top * s);
          ctx.lineTo((x + bw) * s, 520 * s); ctx.fill();
          if (tall && r() < 0.7) ctx.fillRect((x + bw * 0.5) * s, (top - 30) * s, 2 * s, 30 * s);
          ctx.fillStyle = 'rgba(255,170,90,0.6)';
          for (let wy = top + 6; wy < 488; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
            if (r() < 0.05) ctx.fillRect(wx * s, wy * s, 3 * s, 3 * s);
          }
          x += bw + r() * 10;
        }
      }
      ctx.fillStyle = K.linGrad(ctx, 0, 440 * s, 0, 520 * s, [[0, 'rgba(230,140,70,0)'], [0.65, 'rgba(230,140,70,0.25)'], [1, 'rgba(230,140,70,0)']]);
      ctx.fillRect(0, 0, w, h);
      K.ridge(ctx, w, h, 528 * s, 22 * s, '#151613', 14, { step: 28 * s, jag: 0.45 });
      // squad and their light bleed
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const F of squadFigs) ctx.drawImage(F.glow, F.x, F.y);
      ctx.restore();
      for (const F of squadFigs) ctx.drawImage(F.fig, F.x, F.y);
      // legibility: soft shade behind the logo, and the loading area at the bottom
      ctx.fillStyle = K.radGrad(ctx, 280 * s, 320 * s, 0, 420 * s, [[0, 'rgba(6,10,10,0.42)'], [1, 'rgba(6,10,10,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = K.linGrad(ctx, 0, 520 * s, 0, h, [[0, 'rgba(5,7,7,0)'], [0.5, 'rgba(5,7,7,0.72)'], [1, 'rgba(5,7,7,0.9)']]);
      ctx.fillRect(0, 0, w, h);
      K.vignette(ctx, w, h, 0.5, '4,8,8');
      K.grain(ctx, w, h, 0.07, 23);
      out.drawImage(bgc, 0, 0);
      squadOverlay = K.makeCanvas(w - OV.x, h - OV.y);
      const o = squadOverlay.getContext('2d');
      for (const F of squadFigs) o.drawImage(F.fig, F.x - OV.x, F.y - OV.y);
      o.globalCompositeOperation = 'source-in';
      o.drawImage(bgc, -OV.x, -OV.y);
    },
    fg(ctx, t) {
      // horizon fires flicker
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      fires.forEach(([fx, fy, k], i) => {
        ctx.globalAlpha = k * (0.5 + 0.5 * K.hash(Math.floor(t * 12), i));
        ctx.drawImage(fireGlow, Math.round(fx * s - fireGlow.width / 2), Math.round(fy * s - fireGlow.height / 2));
      });
      // distant blasts on the horizon
      for (const [x0, y0, per, off] of [[540, 486, 3.7, 0.9], [1236, 480, 5.3, 2.6]]) {
        const u = ((t + off) % per) / 0.45;
        if (u < 1) {
          ctx.globalAlpha = Math.pow(1 - u, 2) * 0.95;
          const z = fireGlow.width * (1.2 + 1.6 * u);
          ctx.drawImage(fireGlow, x0 * s - z / 2, y0 * s - z / 2, z, z);
        }
      }
      // tracer bursts arcing up out of the city
      ctx.lineCap = 'round';
      for (const [x0, y0, ang, per, off] of [[600, 486, -1.15, 2.6, 0.3], [880, 482, -1.85, 3.3, 1.7], [1180, 480, -1.35, 4.1, 2.9]]) {
        const tb = (t + off) % per;
        for (let i = 0; i < 6; i++) {
          const u = tb - i * 0.07;
          if (u < 0 || u > 0.6) continue;
          const d = u * 700, ca = Math.cos(ang), sa = Math.sin(ang);
          const hx2 = x0 + ca * d, hy2 = y0 + sa * d + u * u * 140;
          const fade = 1 - u / 0.6;
          ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 6 * s;
          ctx.beginPath(); ctx.moveTo(hx2 * s, hy2 * s); ctx.lineTo((hx2 - ca * 26) * s, (hy2 - sa * 26) * s); ctx.stroke();
          ctx.globalAlpha = fade; ctx.strokeStyle = '#ffe2a8'; ctx.lineWidth = 2.4 * s;
          ctx.beginPath(); ctx.moveTo(hx2 * s, hy2 * s); ctx.lineTo((hx2 - ca * 22) * s, (hy2 - sa * 22) * s); ctx.stroke();
        }
      }
      ctx.restore();
      // haze drifting across
      const hx = Math.round(((t * 14) % 1280) * s);
      ctx.save(); ctx.globalAlpha = 0.55;
      ctx.drawImage(haze, -hx, 150 * s); ctx.drawImage(haze, w - hx, 150 * s);
      ctx.restore();
      // helicopters: slow drift, spinning rotors
      const helis = [[heliC, 420 + t * 4, 70 + Math.sin(t * 1.3) * 1.5, 0.22], [heliB, 1040 + t * 6, 92 + Math.sin(t * 1.1 + 2) * 2, 0.4],
        [heliA, 610 + t * 10, 128 + Math.sin(t * 0.9) * 3, 0.78]];
      for (const [spr, hx2, hy, k] of helis) {
        const x0 = Math.round(hx2 * s - spr.width / 2), y0 = Math.round(hy * s - spr.height / 2);
        ctx.drawImage(spr, x0, y0);
        const mx = x0 + (8 + 122) * k * s, my = y0 + (30 - 22) * k * s, Rr = 172 * k * s;
        ctx.fillStyle = 'rgba(22,28,27,0.3)';
        ctx.beginPath(); ctx.ellipse(mx, my, Rr, 4.5 * k * s, 0, 0, K.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(18,22,21,0.9)'; ctx.lineWidth = Math.max(1, 3.4 * k * s); ctx.lineCap = 'round';
        for (let b = 0; b < 2; b++) {
          const a = t * 23 + b * Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(mx - Math.cos(a) * Rr, my - Math.sin(a) * 3 * k * s); ctx.lineTo(mx + Math.cos(a) * Rr, my + Math.sin(a) * 3 * k * s); ctx.stroke();
        }
        const tx = x0 + (8 + 300) * k * s, ty = y0 + (30 + 6) * k * s;
        ctx.fillStyle = 'rgba(22,28,27,0.35)';
        ctx.beginPath(); ctx.arc(tx, ty, 22 * k * s, 0, K.TAU); ctx.fill();
        const ph = (t + k * 3.7) % 1.1;
        if (ph < 0.12) { // anti-collision beacons
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(beacon, x0 + (8 + 296) * k * s - beacon.width / 2, y0 + (30 - 22) * k * s - beacon.height / 2);
          ctx.drawImage(beacon, x0 + (8 + 100) * k * s - beacon.width / 2, y0 + (30 + 62) * k * s - beacon.height / 2);
          ctx.restore();
        }
      }
      if (squadOverlay) ctx.drawImage(squadOverlay, OV.x, OV.y);
      // ash drifting down, sparks rising off the fires
      ctx.save();
      ctx.fillStyle = '#c4beae';
      for (const a of ash) {
        const y = (a.y + t * a.sp) % 760 - 20, x = (a.x + t * a.dr + Math.sin(t * 0.8 + a.ph) * 12) % 1400 - 60;
        ctx.globalAlpha = a.a;
        ctx.fillRect(x * s, y * s, a.z * s, a.z * s);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of sparks) {
        const u = ((t + p.ph) * p.sp) % 260;
        const y = 490 - u, x = p.x + Math.sin((t + p.ph) * 1.7) * p.amp + u * 0.25;
        ctx.globalAlpha = K.clamp(1 - u / 260) * 0.9;
        ctx.drawImage(ember, Math.round(x * s - ember.width / 2), Math.round(y * s - ember.height / 2));
      }
      // IR strobe on the leader's helmet
      if ((t % 1.3) < 0.09) {
        const [sx, sy] = squadDefs[2].f.strobe;
        ctx.globalAlpha = 1; ctx.drawImage(strobe, sx * s - strobe.width / 2, sy * s - strobe.height / 2);
      }
      ctx.restore();

      // logo: TASK FORCE tracks in, ZERO stamps down, the slash flares on impact
      const aTF = K.easeOutCubic((t - 0.2) / 0.4);
      const stamp = K.clamp((t - 0.28) / 0.14);
      if (aTF > 0) {
        ctx.save(); ctx.globalAlpha = aTF;
        const spread = (1 - aTF) * 60;
        if (aTF >= 1) ctx.drawImage(tf.c, Math.round((LOGO_X - 12) * s), Math.round((TF_BASE - 48) * s));
        else ctx.drawImage(tf.c, (LOGO_X - 12 - spread) * s, (TF_BASE - 48) * s, tf.c.width + spread * 2 * s, tf.c.height);
        ctx.restore();
      }
      if (stamp > 0) {
        const sc = K.lerp(1.35, 1, K.easeInCubic(stamp)) + (t > 0.42 ? 0.025 * Math.sin(K.clamp((t - 0.42) / 0.2) * Math.PI) : 0);
        const cx = (LOGO_X + 210) * s, cy = (ZERO_BASE - 90) * s;
        if (t >= 0.62) ctx.drawImage(logo.c, Math.round(LOGO_X * s - logo.zx), Math.round(ZERO_BASE * s - logo.zb));
        else {
          ctx.save(); ctx.globalAlpha = K.clamp(stamp * 3);
          ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
          ctx.drawImage(logo.c, LOGO_X * s - logo.zx, ZERO_BASE * s - logo.zb);
          ctx.restore();
        }
        if (t > 0.42 && t < 0.8) {
          const k = (t - 0.42) / 0.38;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.drawImage(logo.slash, LOGO_X * s - logo.zx, ZERO_BASE * s - logo.zb);
          ctx.globalAlpha = (1 - k) * 0.16; ctx.fillStyle = '#ffd2a0'; ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }
      // light sweep across ZERO every 4 s
      const gp = ((t - 0.9) % 4) / 0.7;
      if (t > 0.9 && gp < 1) {
        const g = sweepCtx;
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, sweep.width, sweep.height);
        g.drawImage(logo.letters, 0, 0);
        g.globalCompositeOperation = 'source-in';
        const gx = K.lerp(-0.2, 1.1, gp) * sweep.width;
        g.fillStyle = K.linGrad(g, gx - 50 * s, 0, gx + 50 * s, sweep.height * 0.3, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,250,235,0.5)'], [1, 'rgba(255,255,255,0)']]);
        g.fillRect(0, 0, sweep.width, sweep.height);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sweep, LOGO_X * s - logo.zx, ZERO_BASE * s - logo.zb);
        ctx.restore();
      }

      // loading UI
      const ui = K.easeOutCubic((t - 0.5) / 0.45);
      if (ui > 0) {
        ctx.save();
        ctx.globalAlpha = ui;
        ctx.drawImage(card, Math.round((70 - (1 - ui) * 40) * s), Math.round(520 * s));
        ctx.globalAlpha = ui * K.clamp((t - 0.7) / 0.3);
        ctx.drawImage(tip, Math.round(70 * s), Math.round(640 * s));
        const p = progress(t), bx = 70 * s, bw = 1140 * s, by = 684 * s;
        ctx.globalAlpha = ui;
        ctx.fillStyle = 'rgba(236,232,220,0.16)'; ctx.fillRect(bx, by, bw, 3 * s);
        ctx.fillStyle = p < 1 ? ORANGE : OFFWHITE; ctx.fillRect(bx, by, bw * p, 3 * s);
        if (p > 0 && p < 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(ember, bx + bw * p - 12 * s, by - 10 * s, 24 * s, 24 * s);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (p < 1) {
          ctx.font = loadFont; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = OFFWHITE;
          ctx.fillText(`LOADING  ${Math.floor(p * 100)}%`, 1166 * s, 660 * s);
          const a0 = t * 5;
          ctx.lineWidth = 3 * s; ctx.lineCap = 'butt';
          for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(239,125,44,${(0.15 + 0.85 * ((i + 1) / 8)).toFixed(2)})`;
            ctx.beginPath(); ctx.arc(1196 * s, 659 * s, 10 * s, a0 + i * 0.75, a0 + i * 0.75 + 0.5); ctx.stroke();
          }
        } else if (K.blinkOn(t - 3.6, 0.9, 0.7)) {
          ctx.drawImage(pressAny, 1210 * s - pressAny.width, 642 * s);
        }
        ctx.restore();
      }
    },
  };
}
