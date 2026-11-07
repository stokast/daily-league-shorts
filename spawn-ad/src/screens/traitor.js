// STARSHIP SUSPECTS: a made-up cute social-deduction party game in space.
// Five chubby gumdrop robots (screen faces, pixel eyes, glowing antennae) stand in a starship lounge in
// front of a big window onto deep space. One of them, half in shadow with red slit eyes, is the traitor.
import * as K from './kit.js';

export const meta = { id: 'traitor', title: 'STARSHIP SUSPECTS', aspect: 16 / 9 };

/* ------------------------------------------------------------------ helpers */

function spline(c, pts, closed = true) {
  const n = pts.length;
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
function rrPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(K.lerp(v, b[i], t)));
const rgb = (a, al = 1) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;
const WHITE = [255, 255, 255], INK = [27, 20, 62];

function glowSprite(R, stops) {
  const c = K.makeCanvas(R * 2, R * 2), x = c.getContext('2d');
  x.fillStyle = K.radGrad(x, R, R, 0, R, stops);
  x.fillRect(0, 0, R * 2, R * 2);
  return c;
}

/* ------------------------------------------------------------------ robots */

const EYES = {
  open: ['.11.', '1111', '1111', '1111', '.11.'],
  happy: ['.11.', '1..1', '1..1'],
  closed: ['1111'],
  heart: ['11.11', '11111', '11111', '.111.', '..1..'],
  big: ['.111.', '11111', '11.11', '11111', '.111.'],
  slitL: ['11....', '.1111.', '...111'],
  slitR: ['....11', '.1111.', '111...'],
};
const MOUTH = { smile: ['1...1', '.111.'], open: ['.11.', '1..1', '.11.'], smirk: ['....1', '1111.'], none: [] };

function pixels(c, grid, cx, cy, px) {
  const gw = Math.max(...grid.map((r) => r.length)), gh = grid.length;
  const x0 = cx - (gw * px) / 2, y0 = cy - (gh * px) / 2;
  grid.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') c.fillRect(x0 + i * px, y0 + j * px, px - 0.6, px - 0.6); }));
}

// Gumdrop body outline, origin at the bottom centre (y up is negative).
function bodyPath(c, W, H) {
  spline(c, [[-W * 0.5, -H * 0.1], [-W * 0.47, -H * 0.42], [-W * 0.4, -H * 0.71], [-W * 0.25, -H * 0.93], [0, -H],
    [W * 0.25, -H * 0.93], [W * 0.4, -H * 0.71], [W * 0.47, -H * 0.42], [W * 0.5, -H * 0.1], [W * 0.4, 0], [0, H * 0.025], [-W * 0.4, 0]]);
}

// One robot sprite. o: { W, H, col (hex), tip (hex), eyes, eyesR, mouth, look, eyeCol, traitor, waveArm }
// Returns { c, ox, oy } where (ox, oy) is the body's bottom centre inside the sprite (device px).
function robot(s, o) {
  const { W, H } = o;
  const SW = Math.ceil((W * 1.75 + 40) * s), SH = Math.ceil((H + 120) * s);
  const c = K.makeCanvas(SW, SH), x = c.getContext('2d');
  const ox = SW / 2, oy = SH - 26 * s;
  x.setTransform(s, 0, 0, s, ox, oy);
  const base = hex(o.col), light = mix(base, WHITE, 0.45), dark = mix(base, INK, 0.45), deep = mix(base, INK, 0.7);
  const ink = rgb(INK);
  x.lineJoin = 'round'; x.lineCap = 'round';
  // antenna stalk
  x.strokeStyle = ink; x.lineWidth = 8;
  x.beginPath(); x.moveTo(0, -H + 4); x.quadraticCurveTo(W * 0.06, -H - 26, W * 0.03, -H - 46); x.stroke();
  x.strokeStyle = rgb(mix(base, INK, 0.25)); x.lineWidth = 3.5; x.stroke();
  // feet
  for (const sx of [-1, 1]) {
    x.beginPath(); x.ellipse(sx * W * 0.21, 1, W * 0.15, 10, 0, 0, K.TAU);
    x.fillStyle = rgb(dark); x.fill(); x.lineWidth = 4; x.strokeStyle = ink; x.stroke();
  }
  // arms (stubby, angled down); the waving one is drawn separately at runtime
  const arm = (sx) => {
    x.save(); x.translate(sx * W * 0.44, -H * 0.42); x.rotate(sx * 0.55);
    x.beginPath(); rrPath(x, -11, -6, 22, 46, 11);
    x.fillStyle = K.linGrad(x, 0, -6, 0, 40, [[0, rgb(light)], [1, rgb(base)]]); x.fill();
    x.lineWidth = 4; x.strokeStyle = ink; x.stroke(); x.restore();
  };
  arm(-1); if (!o.waveArm) arm(1);
  // body with glossy shading
  x.beginPath(); bodyPath(x, W, H);
  x.fillStyle = K.linGrad(x, 0, -H, 0, 0, [[0, rgb(light)], [0.45, rgb(base)], [1, rgb(dark)]]);
  x.fill();
  x.save(); x.clip();
  x.fillStyle = K.radGrad(x, -W * 0.18, -H * 0.72, 0, W * 0.95, [[0, 'rgba(255,255,255,0.0)'], [0.55, 'rgba(0,0,0,0)'], [1, rgb(deep, 0.55)]]);
  x.fillRect(-W, -H * 1.2, W * 2, H * 1.3);
  x.fillStyle = K.linGrad(x, W * 0.5, 0, W * 0.3, 0, [[0, 'rgba(255,214,240,0.55)'], [1, 'rgba(255,214,240,0)']]); // rim from the planet
  x.fillRect(W * 0.2, -H, W * 0.4, H);
  x.fillStyle = 'rgba(255,255,255,0.55)';
  x.beginPath(); x.ellipse(-W * 0.2, -H * 0.82, W * 0.13, H * 0.07, -0.6, 0, K.TAU); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.beginPath(); x.ellipse(-W * 0.27, -H * 0.74, W * 0.035, H * 0.025, -0.6, 0, K.TAU); x.fill();
  // belt stripe + belly light
  x.fillStyle = rgb(mix(base, INK, 0.2));
  x.fillRect(-W, -H * 0.25, W * 2, H * 0.07);
  x.restore();
  x.beginPath(); x.arc(0, -H * 0.13, W * 0.055, 0, K.TAU);
  x.fillStyle = rgb(mix(hex(o.tip), WHITE, 0.3)); x.fill(); x.lineWidth = 3; x.strokeStyle = ink; x.stroke();
  x.beginPath(); bodyPath(x, W, H); x.lineWidth = 5; x.strokeStyle = ink; x.stroke();
  // screen face
  const fw = W * 0.64, fh = H * 0.36, fx = -fw / 2, fy = -H * 0.77;
  x.beginPath(); rrPath(x, fx - 5, fy - 5, fw + 10, fh + 10, 22);
  x.fillStyle = rgb(mix(base, WHITE, 0.25)); x.fill(); x.lineWidth = 4; x.strokeStyle = ink; x.stroke();
  x.beginPath(); rrPath(x, fx, fy, fw, fh, 17);
  x.fillStyle = K.linGrad(x, 0, fy, 0, fy + fh, [[0, '#1a1b40'], [1, '#0b0b22']]); x.fill();
  // eyes (+ glow)
  const ecol = o.eyeCol || '#c6fbff';
  const px = Math.max(4.2, W * 0.034);
  const ey = fy + fh * (o.mouth && o.mouth !== 'none' ? 0.42 : 0.52), ex = fw * 0.22, lk = (o.look || 0) * px;
  const drawFace = (ctx) => {
    ctx.fillStyle = ecol;
    pixels(ctx, EYES[o.eyes], -ex + lk, ey, px);
    pixels(ctx, EYES[o.eyesR || o.eyes], ex + lk, ey, px);
    if (o.mouth && o.mouth !== 'none') pixels(ctx, MOUTH[o.mouth], lk * 0.5, fy + fh * 0.76, px * 0.8);
  };
  const g = K.makeCanvas(SW, SH), gx = g.getContext('2d');
  gx.setTransform(s, 0, 0, s, ox, oy); drawFace(gx);
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter';
  x.filter = `blur(${(5 * s).toFixed(1)}px)`; x.globalAlpha = 0.9; x.drawImage(g, 0, 0); x.filter = 'none';
  x.globalAlpha = 1; x.restore();
  drawFace(x);
  // glass reflection
  x.save(); x.beginPath(); rrPath(x, fx, fy, fw, fh, 17); x.clip();
  x.fillStyle = 'rgba(255,255,255,0.10)';
  x.beginPath(); x.moveTo(fx + fw * 0.55, fy); x.lineTo(fx + fw * 0.8, fy); x.lineTo(fx + fw * 0.45, fy + fh); x.lineTo(fx + fw * 0.2, fy + fh); x.fill();
  x.restore();
  if (o.traitor) { // deep shadow over the traitor, eyes left burning
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = K.linGrad(x, 0, 0, SW, 0, [[0, 'rgba(14,8,40,0.35)'], [1, 'rgba(14,8,40,0.62)']]);
    x.fillRect(0, 0, SW, SH);
    x.globalCompositeOperation = 'lighter';
    x.filter = `blur(${(7 * s).toFixed(1)}px)`; x.drawImage(g, 0, 0); x.filter = 'none';
    x.globalCompositeOperation = 'source-over';
    x.restore();
    x.save(); x.setTransform(s, 0, 0, s, ox, oy); drawFace(x); x.restore();
  }
  // antenna tip
  x.save(); x.setTransform(s, 0, 0, s, ox, oy);
  x.beginPath(); x.arc(W * 0.03, -H - 50, 9.5, 0, K.TAU);
  x.fillStyle = K.radGrad(x, W * 0.03 - 3, -H - 53, 0, 10, [[0, '#ffffff'], [0.35, o.tip], [1, rgb(mix(hex(o.tip), INK, 0.3))]]);
  x.fill(); x.lineWidth = 4; x.strokeStyle = ink; x.stroke();
  x.restore();
  return { c, ox, oy, tipX: W * 0.03, tipY: -H - 50 };
}

function waveArm(s, W, col) {
  const base = hex(col), light = mix(base, WHITE, 0.45);
  const c = K.makeCanvas(60 * s, 80 * s), x = c.getContext('2d');
  x.setTransform(s, 0, 0, s, 30 * s, 16 * s); // pivot (shoulder) at (30, 16)
  x.beginPath(); rrPath(x, -11, -6, 22, 48, 11);
  x.fillStyle = K.linGrad(x, 0, -6, 0, 42, [[0, rgb(light)], [1, rgb(base)]]); x.fill();
  x.lineWidth = 4; x.strokeStyle = rgb(INK); x.stroke();
  return c;
}

/* ------------------------------------------------------------------ logo */

// Per-letter sprites so the letters can bounce independently.
function logoWord(s, text, px, pal) {
  const m = K.makeCanvas(4, 4).getContext('2d');
  m.font = K.font(400, px * s, 'Titan One');
  const asc = m.measureText('S').actualBoundingBoxAscent;
  const ow = px * 0.16 * s, ext = px * 0.09 * s, pad = ow + ext + 8 * s;
  const letters = [];
  let cx = 0;
  const track = 0.02 * px * s;
  for (const ch of text) {
    const aw = m.measureText(ch).width;
    const W = Math.ceil(aw + pad * 2), H = Math.ceil(asc + pad * 2 + ext);
    const c = K.makeCanvas(W, H), x = c.getContext('2d');
    const f = K.makeCanvas(W, H), fx = f.getContext('2d');
    x.font = fx.font = K.font(400, px * s, 'Titan One'); x.textBaseline = fx.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    const bx = pad, by = pad + asc;
    for (let i = Math.ceil(ext / s); i >= 1; i--) { // extrusion
      const k = i / Math.ceil(ext / s);
      x.fillStyle = x.strokeStyle = rgb(mix(hex(pal.ext[0]), hex(pal.ext[1]), k));
      x.lineWidth = ow * 2; x.strokeText(ch, bx, by + i * s); x.fillText(ch, bx, by + i * s);
    }
    x.lineWidth = ow * 2; x.strokeStyle = pal.ink; x.strokeText(ch, bx, by);
    x.lineWidth = ow * 0.7; x.strokeStyle = pal.inner; x.strokeText(ch, bx, by);
    fx.fillStyle = K.linGrad(fx, 0, by - asc, 0, by, pal.fill); fx.fillText(ch, bx, by);
    // shine: upper band + a highlight dot
    const sh = K.makeCanvas(W, H), sx = sh.getContext('2d');
    sx.font = x.font; sx.fillStyle = '#fff'; sx.fillText(ch, bx, by);
    sx.globalCompositeOperation = 'destination-out'; sx.fillText(ch, bx, by + asc * 0.12);
    sx.fillRect(0, by - asc * 0.45, W, H);
    fx.globalAlpha = 0.55; fx.drawImage(sh, 0, 0); fx.globalAlpha = 1;
    letters.push({ c, f, x: cx - pad, y: -by, aw, ch });
    cx += aw + track;
  }
  return { letters, width: cx - track, asc };
}

/* ------------------------------------------------------------------ screen */

export function create(w, h) {
  const s = w / 1280;
  const crew = [
    { col: '#b8ec5e', tip: '#ff8fd0', eyes: 'big', mouth: 'open', W: 138, H: 150, x: 236, y: 584, ph: 0.4 },
    { col: '#40d6c6', tip: '#ffe46b', eyes: 'happy', mouth: 'smile', W: 150, H: 162, x: 428, y: 592, ph: 1.7 },
    { col: '#ffb48f', tip: '#7ff3ff', eyes: 'open', mouth: 'smile', W: 164, H: 176, x: 640, y: 602, ph: 3.1, waveArm: true },
    { col: '#ff92c6', tip: '#b6ff7a', eyes: 'heart', mouth: 'none', W: 150, H: 162, x: 852, y: 592, ph: 4.4 },
    { col: '#ad97ff', tip: '#ff4d6d', eyes: 'slitL', eyesR: 'slitR', mouth: 'smirk', W: 144, H: 156, x: 1062, y: 580, ph: 5.2,
      traitor: true, eyeCol: '#ff3d55', look: -1.2 },
  ];
  const sprites = crew.map((o) => ({
    open: robot(s, o),
    shut: o.traitor ? robot(s, { ...o, look: 0.4 }) : robot(s, { ...o, eyes: 'closed', eyesR: 'closed' }),
  }));
  const arm = waveArm(s, crew[2].W, crew[2].col);
  const shadow = (() => {
    const c = K.makeCanvas(200 * s, 40 * s), x = c.getContext('2d');
    x.fillStyle = K.radGrad(x, 100 * s, 20 * s, 0, 100 * s, [[0, 'rgba(8,4,26,0.6)'], [1, 'rgba(8,4,26,0)']]);
    x.setTransform(1, 0, 0, 0.2, 0, 16 * s); x.fillRect(0, -80 * s, 200 * s, 200 * s);
    return c;
  })();
  const tipGlow = glowSprite(26 * s, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  const redGlow = glowSprite(34 * s, [[0, 'rgba(255,90,110,0.9)'], [0.3, 'rgba(255,40,70,0.4)'], [1, 'rgba(255,0,40,0)']]);
  const star4 = (() => {
    const R = 22 * s, c = K.makeCanvas(R * 2, R * 2), x = c.getContext('2d');
    x.translate(R, R); x.fillStyle = '#fff';
    x.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * K.TAU, r = i % 2 ? R * 0.16 : R; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.fill();
    return c;
  })();

  // logo
  const W1 = logoWord(s, 'STARSHIP', 84, {
    fill: [[0, '#ffffff'], [0.6, '#dffaff'], [1, '#9fe8ff']], ink: '#1b143e', inner: '#ffffff', ext: ['#7a5cf0', '#2c1d6e'],
  });
  const W2 = logoWord(s, 'SUSPECTS', 132, {
    fill: [[0, '#fff7b0'], [0.45, '#ffd84a'], [1, '#ff9a3c']], ink: '#1b143e', inner: '#fff2c8', ext: ['#ff5c9a', '#6e1d5e'],
  });
  const LOGO_Y1 = 118, LOGO_Y2 = 258; // baselines (design)

  // tagline + menu
  const tagline = (() => {
    const c = K.makeCanvas(420 * s, 56 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.beginPath(); rrPath(x, 4, 6, 412, 44, 22);
    x.fillStyle = 'rgba(16,10,46,0.78)'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = 'rgba(190,170,255,0.7)'; x.stroke();
    x.font = K.font(600, 25, 'Fredoka'); x.textBaseline = 'middle'; x.textAlign = 'left';
    const a = 'one of you is ', b = 'lying';
    const wa = x.measureText(a).width, wb = x.measureText(b).width;
    const x0 = 210 - (wa + wb) / 2;
    x.fillStyle = '#f2ecff'; x.fillText(a, x0, 29);
    x.fillStyle = '#ff5876'; x.fillText(b, x0 + wa, 29);
    return c;
  })();
  const button = (label, c1, c2, edge) => {
    const c = K.makeCanvas(250 * s, 84 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.beginPath(); rrPath(x, 6, 14, 238, 60, 30); x.fillStyle = edge; x.fill();
    x.beginPath(); rrPath(x, 6, 6, 238, 60, 30);
    x.fillStyle = K.linGrad(x, 0, 6, 0, 66, [[0, c1], [1, c2]]); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#1b143e'; x.stroke();
    x.beginPath(); rrPath(x, 22, 12, 206, 20, 10); x.fillStyle = 'rgba(255,255,255,0.28)'; x.fill();
    x.font = K.font(400, 30, 'Lilita One'); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(27,20,62,0.55)'; x.fillText(label, 125, 41);
    x.fillStyle = '#ffffff'; x.fillText(label, 125, 38);
    return c;
  };
  const host = button('HOST GAME', '#5ff0c6', '#18b08e', '#0d6e5c');
  const join = button('JOIN GAME', '#9d97ff', '#5c55e8', '#352d9a');
  const ring = (() => {
    const c = K.makeCanvas(266 * s, 92 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.beginPath(); rrPath(x, 5, 5, 256, 78, 39); x.lineWidth = 4; x.strokeStyle = '#ffffff'; x.stroke();
    return c;
  })();
  const players = (() => {
    const c = K.makeCanvas(236 * s, 56 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.beginPath(); rrPath(x, 4, 6, 228, 44, 22);
    x.fillStyle = 'rgba(16,10,46,0.8)'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = 'rgba(190,170,255,0.7)'; x.stroke();
    // tiny robot icon
    x.save(); x.translate(34, 43);
    x.strokeStyle = '#1b143e'; x.lineWidth = 2.5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, -27); x.lineTo(1, -33); x.stroke();
    x.beginPath(); x.arc(1, -34, 3.2, 0, K.TAU); x.fillStyle = '#ffe46b'; x.fill(); x.stroke();
    x.beginPath(); bodyPath(x, 28, 27); x.fillStyle = '#40d6c6'; x.fill(); x.stroke();
    x.beginPath(); rrPath(x, -9, -21, 18, 10, 3); x.fillStyle = '#1a1b40'; x.fill();
    x.fillStyle = '#c6fbff'; x.fillRect(-6, -18, 3, 4); x.fillRect(3, -18, 3, 4);
    x.restore();
    x.font = K.font(700, 21, 'Fredoka'); x.textBaseline = 'middle'; x.fillStyle = '#f2ecff';
    x.fillText('PLAYERS', 58, 29);
    x.fillStyle = '#ffd84a'; x.fillText('4/10', 156, 29);
    return c;
  })();
  const cursor = (() => {
    const c = K.makeCanvas(36 * s, 40 * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0); x.lineJoin = 'round';
    x.beginPath(); x.moveTo(6, 6); x.lineTo(30, 20); x.lineTo(6, 34); x.closePath();
    x.fillStyle = '#ffd84a'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#1b143e'; x.stroke();
    return c;
  })();

  // twinkling stars + panel lights
  const R = K.rng(404);
  const twinkles = Array.from({ length: 26 }, () => ({ x: 70 + R() * 1140, y: 40 + R() * 460, f: 0.6 + R() * 1.6, ph: R() * 6, z: 0.25 + R() * 0.4 }));
  const WIN = { x: 34, y: 22, w: 1212, h: 540, r: 64 };

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      // ship interior wall around the window
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#251c4f'], [1, '#160f33']]);
      ctx.fillRect(0, 0, 1280, 720);
      // space through the window
      ctx.save();
      ctx.beginPath(); rrPath(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.clip();
      ctx.fillStyle = K.linGrad(ctx, 0, WIN.y, 0, WIN.y + WIN.h, [[0, '#090a2a'], [0.45, '#191652'], [0.8, '#3a1f73'], [1, '#5a2a86']]);
      ctx.fillRect(0, 0, 1280, 720);
      // nebula
      {
        const nb = K.makeCanvas(1280, 720), x = nb.getContext('2d');
        const r = K.rng(12);
        const cols = ['255,80,170', '140,90,255', '60,210,220', '255,120,200'];
        for (let i = 0; i < 26; i++) {
          const u = r(), px = 80 + u * 1120, py = 520 - u * 330 + (r() - 0.5) * 200, pr = 70 + r() * 150;
          x.fillStyle = K.radGrad(x, px, py, 0, pr, [[0, `rgba(${cols[i % 4]},${(0.1 + r() * 0.12).toFixed(2)})`], [1, `rgba(${cols[i % 4]},0)`]]);
          x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        }
        ctx.filter = 'blur(10px)'; ctx.drawImage(nb, 0, 0); ctx.filter = 'none';
      }
      K.stars(ctx, 1280, 600, { n: 260, seed: 9, maxR: 2.2 });
      // small moon
      ctx.fillStyle = K.radGrad(ctx, 236, 134, 2, 30, [[0, '#c9d2ff'], [0.7, '#8a90d8'], [1, '#4b4a9a']]);
      ctx.beginPath(); ctx.arc(244, 140, 28, 0, K.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,56,140,0.45)';
      for (const [cx, cy, cr] of [[236, 132, 6], [254, 150, 4.5], [248, 128, 3]]) { ctx.beginPath(); ctx.arc(cx, cy, cr, 0, K.TAU); ctx.fill(); }
      // ringed planet: back half of the ring, planet, front half of the ring
      const PX = 1050, PY = 196, PR = 104, tilt = -0.28;
      const ringPass = (front) => {
        ctx.save();
        ctx.translate(PX, PY); ctx.rotate(tilt);
        ctx.beginPath(); ctx.rect(-400, front ? 0 : -400, 800, 400); ctx.clip();
        for (const [rx, ry, lw, col] of [[196, 50, 14, 'rgba(255,214,190,0.75)'], [178, 45, 8, 'rgba(255,170,200,0.55)'], [222, 57, 6, 'rgba(210,190,255,0.5)']]) {
          ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, K.TAU); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
        }
        ctx.restore();
      };
      ringPass(false);
      ctx.save();
      ctx.beginPath(); ctx.arc(PX, PY, PR, 0, K.TAU); ctx.clip();
      ctx.fillStyle = K.linGrad(ctx, PX - PR, PY - PR, PX + PR, PY + PR, [[0, '#ffd2a8'], [0.45, '#ff8f9a'], [1, '#6a2f8a']]);
      ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2);
      ctx.translate(PX, PY); ctx.rotate(tilt);
      for (const [yy, hh, col] of [[-62, 14, 'rgba(255,240,220,0.35)'], [-28, 22, 'rgba(200,80,140,0.25)'], [10, 12, 'rgba(255,230,210,0.3)'], [44, 26, 'rgba(120,40,120,0.3)']]) {
        ctx.fillStyle = col; ctx.fillRect(-PR * 1.2, yy, PR * 2.4, hh);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(s, s);
      ctx.fillStyle = K.radGrad(ctx, PX + 70, PY + 60, 10, PR * 1.6, [[0, 'rgba(30,10,60,0.75)'], [0.6, 'rgba(30,10,60,0.15)'], [1, 'rgba(30,10,60,0)']]);
      ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2);
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,220,240,0.6)';
      ctx.beginPath(); ctx.arc(PX, PY, PR - 1, Math.PI * 0.95, Math.PI * 1.65); ctx.stroke();
      ringPass(true);
      // glass reflections
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.beginPath(); ctx.moveTo(140, 22); ctx.lineTo(300, 22); ctx.lineTo(80, 562); ctx.lineTo(-80, 562); ctx.fill();
      ctx.beginPath(); ctx.moveTo(330, 22); ctx.lineTo(380, 22); ctx.lineTo(160, 562); ctx.lineTo(110, 562); ctx.fill();
      ctx.restore();
      // window frame
      ctx.beginPath(); rrPath(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r);
      ctx.lineWidth = 30; ctx.strokeStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#6c5fb0'], [0.5, '#4a3f8a'], [1, '#2e2666']]); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#140d33'; ctx.stroke();
      ctx.beginPath(); rrPath(ctx, WIN.x - 15, WIN.y - 15, WIN.w + 30, WIN.h + 30, WIN.r + 15);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(190,175,255,0.35)'; ctx.stroke();
      ctx.fillStyle = '#9d90e0';
      for (let i = 0; i < 14; i++) { const bx = WIN.x + 110 + i * 80; ctx.beginPath(); ctx.arc(bx, WIN.y - 1, 3, 0, K.TAU); ctx.fill(); }
      // deck
      ctx.fillStyle = K.linGrad(ctx, 0, 556, 0, 720, [[0, '#2f2766'], [0.35, '#221a4e'], [1, '#110b2a']]);
      ctx.fillRect(0, 556, 1280, 164);
      ctx.fillStyle = '#62f2e6'; ctx.fillRect(0, 556, 1280, 3);
      ctx.fillStyle = K.linGrad(ctx, 0, 556, 0, 600, [[0, 'rgba(98,242,230,0.35)'], [1, 'rgba(98,242,230,0)']]);
      ctx.fillRect(0, 559, 1280, 40);
      ctx.strokeStyle = 'rgba(160,140,255,0.12)'; ctx.lineWidth = 2;
      for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(640 + i * 60, 560); ctx.lineTo(640 + i * 210, 720); ctx.stroke(); }
      for (const yy of [600, 650]) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(1280, yy); ctx.stroke(); }
      // warm overhead light on the crew; the far right stays in shadow
      ctx.fillStyle = K.radGrad(ctx, 600, 520, 0, 520, [[0, 'rgba(255,214,170,0.16)'], [1, 'rgba(255,214,170,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.radGrad(ctx, 1170, 560, 0, 400, [[0, 'rgba(10,4,30,0.55)'], [0.6, 'rgba(10,4,30,0.25)'], [1, 'rgba(10,4,30,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
      K.vignette(ctx, w, h, 0.45, '8,4,26');
    },
    fg(ctx, t) {
      // twinkling stars
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const st of twinkles) {
        const a = Math.pow(0.5 + 0.5 * Math.sin(t * st.f * 2 + st.ph), 3);
        if (a < 0.05) continue;
        ctx.globalAlpha = a;
        const z = star4.width * st.z;
        ctx.drawImage(star4, st.x * s - z / 2, st.y * s - z / 2, z, z);
      }
      // shooting star every 4.5 s
      const sp = ((t - 1.2) % 4.5) / 0.7;
      if (t > 1.2 && sp < 1) {
        const x0 = 380 + sp * 420, y0 = 70 + sp * 120;
        const g = ctx.createLinearGradient((x0 - 90) * s, (y0 - 26) * s, x0 * s, y0 * s);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.globalAlpha = Math.sin(sp * Math.PI); ctx.strokeStyle = g; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo((x0 - 90) * s, (y0 - 26) * s); ctx.lineTo(x0 * s, y0 * s); ctx.stroke();
      }
      ctx.restore();

      // crew: bob, blink, the traitor glances and glints
      crew.forEach((o, i) => {
        const bob = Math.sin(t * 2.3 + o.ph) * 5;
        ctx.save();
        ctx.globalAlpha = 0.9 - bob * 0.03;
        const shw = (o.W * 1.25 - bob * 2) * s;
        ctx.drawImage(shadow, o.x * s - shw / 2, (o.y - 8) * s, shw, 26 * s);
        ctx.restore();
        const blinkT = (t + o.ph * 0.77) % 3.6;
        const glance = o.traitor && ((t % 3.1) > 1.9 && (t % 3.1) < 2.6);
        const spr = o.traitor ? (glance ? sprites[i].shut : sprites[i].open) : (blinkT < 0.13 ? sprites[i].shut : sprites[i].open);
        const X = Math.round(o.x * s), Y = Math.round((o.y + bob * 0.6 - 4) * s);
        ctx.drawImage(spr.c, Math.round(X - spr.ox), Math.round(Y - spr.oy));
        if (o.waveArm) {
          const a = -2.3 + Math.sin(t * 7) * 0.35;
          ctx.save();
          ctx.translate(X + o.W * 0.44 * s, Y - o.H * 0.42 * s);
          ctx.rotate(a);
          ctx.drawImage(arm, -30 * s, -16 * s);
          ctx.restore();
        }
        // antenna tip glow
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3 + o.ph);
        const tg = o.traitor ? redGlow : tipGlow;
        ctx.drawImage(tg, X + spr.tipX * s - tg.width / 2, Y + spr.tipY * s - tg.height / 2);
        if (glance) {
          const k = ((t % 3.1) - 1.9) / 0.7;
          ctx.globalAlpha = Math.sin(k * Math.PI);
          const z = 44 * s * (0.6 + 0.4 * Math.sin(k * Math.PI));
          ctx.drawImage(star4, X - 0.16 * o.W * s - z / 2, Y - o.H * 0.66 * s - z / 2, z, z);
        }
        ctx.restore();
      });

      // logo: letters pop in one by one with a bounce, then keep a gentle wave
      const drawWord = (Wd, baseY, t0, amp, layer) => {
        const x0 = 640 * s - Wd.width / 2;
        Wd.letters.forEach((L, i) => {
          const p = K.clamp((t - t0 - i * 0.02) / 0.25);
          if (p <= 0) return;
          const img = layer ? L.f : L.c;
          const wave = Math.sin(t * 3.2 - i * 0.55) * amp * K.clamp((t - 1) / 0.5);
          const cx = x0 + L.x + img.width / 2, cy = baseY * s + wave * s;
          if (p < 1) {
            const sc = K.easeOutBack(p, 2.6);
            ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = K.clamp(p * 4);
            ctx.drawImage(img, -img.width / 2, L.y); ctx.restore();
          } else ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy + L.y));
        });
      };
      for (const layer of [0, 1]) { drawWord(W1, LOGO_Y1, 0.18, 2.5, layer); drawWord(W2, LOGO_Y2, 0.22, 3.5, layer); }

      // tagline + menu
      const ui = K.easeOutBack((t - 0.55) / 0.35, 1.8);
      if (t > 0.55) {
        ctx.save();
        ctx.globalAlpha = K.clamp((t - 0.55) / 0.18);
        ctx.translate(640 * s, 292 * s); ctx.scale(ui, ui);
        ctx.drawImage(tagline, -tagline.width / 2, -tagline.height / 2);
        ctx.restore();
      }
      const ub = K.easeOutBack((t - 0.64) / 0.36, 1.6);
      if (t > 0.64) {
        ctx.save();
        ctx.globalAlpha = K.clamp((t - 0.64) / 0.18);
        const by = (680 + (1 - ub) * 60) * s;
        ctx.drawImage(host, 380 * s, by - host.height / 2);
        ctx.drawImage(join, 650 * s, by - join.height / 2);
        ctx.drawImage(players, 1236 * s - players.width, by - players.height / 2);
        const pulse = 0.55 + 0.45 * Math.sin(t * 5);
        ctx.globalAlpha *= pulse;
        ctx.drawImage(ring, (380 - 2) * s, by - ring.height / 2 - 4 * s);
        ctx.globalAlpha = K.clamp((t - 0.64) / 0.18);
        ctx.drawImage(cursor, (340 + Math.sin(t * 6) * 6) * s, by - cursor.height / 2 - 4 * s);
        ctx.restore();
      }
    },
  };
}
