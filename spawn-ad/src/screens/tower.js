// KEEP DEFENDERS: tower defense. A castle on a hill at golden hour, towers firing glowing arcs at a marching
// column along a winding path; blue/gold Lilita One logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'tower', title: 'KEEP DEFENDERS', word: 'tower defense', aspect: 16 / 9 };

const NAVY = '#0d1f5c';
// winding path (polyline, design units) from the foreground up to the castle gate
const PATH = [[-40, 700], [180, 660], [420, 640], [560, 600], [470, 560], [300, 535], [360, 505], [600, 492], [820, 480], [930, 452]];
const SEG = [];
let TOTAL = 0;
for (let i = 1; i < PATH.length; i++) { const d = Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]); SEG.push(d); TOTAL += d; }
function along(u) {
  let d = u * TOTAL;
  for (let i = 0; i < SEG.length; i++) {
    if (d <= SEG[i]) { const k = d / SEG[i]; return [K.lerp(PATH[i][0], PATH[i + 1][0], k), K.lerp(PATH[i][1], PATH[i + 1][1], k)]; }
    d -= SEG[i];
  }
  return PATH[PATH.length - 1];
}
// defense towers: [x, y (base), scale]
const TOWERS = [[640, 668, 1.0], [200, 560, 0.75], [700, 545, 0.6]];

function tower(c, k) {
  c.save(); c.scale(k, k); c.lineJoin = 'round';
  K.roundRect(c, -34, -120, 68, 120, 6);
  c.fillStyle = K.linGrad(c, -34, 0, 34, 0, [[0, '#c7c2b8'], [0.5, '#e8e3d8'], [1, '#8f897e']]); c.fill();
  c.lineWidth = 5; c.strokeStyle = '#3a3428'; c.stroke();
  c.fillStyle = '#3a3428'; c.fillRect(-10, -86, 20, 26);
  M.poly(c, [-46, -116, 46, -116, 0, -184]); c.fillStyle = K.linGrad(c, -46, 0, 46, 0, [[0, '#2f6bff'], [1, '#183a9e']]); c.fill(); c.stroke();
  c.fillStyle = '#ffd23f'; M.poly(c, [0, -184, 0, -214, 26, -204, 0, -196]); c.fill();
  c.strokeStyle = '#3a3428'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -184); c.lineTo(0, -214); c.stroke();
  c.restore();
}

function castle(c) {
  // origin = gate bottom centre
  c.lineJoin = 'round';
  const stone = (x, y, ww, hh) => {
    c.fillStyle = K.linGrad(c, x, 0, x + ww, 0, [[0, '#d9d2c3'], [1, '#a59d8c']]); c.fillRect(x, y, ww, hh);
    c.lineWidth = 5; c.strokeStyle = '#3a3428'; c.strokeRect(x, y, ww, hh);
    c.fillStyle = '#3a3428';
    for (let bx = x; bx < x + ww - 4; bx += 22) c.fillRect(bx + 4, y - 14, 12, 14);
  };
  const roof = (x, y, ww, hh) => {
    M.poly(c, [x - 8, y, x + ww + 8, y, x + ww / 2, y - hh]);
    c.fillStyle = K.linGrad(c, x, 0, x + ww, 0, [[0, '#3d7bff'], [1, '#1a3a9a']]); c.fill(); c.lineWidth = 5; c.strokeStyle = '#3a3428'; c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(x + ww / 2, y - hh); c.lineTo(x + ww / 2, y - hh - 30); c.stroke();
    c.fillStyle = '#ffd23f'; M.poly(c, [x + ww / 2, y - hh - 30, x + ww / 2 + 30, y - hh - 22, x + ww / 2, y - hh - 14]); c.fill();
  };
  stone(-130, -120, 260, 120);           // curtain wall
  stone(-200, -190, 80, 190); roof(-200, -190, 80, 90);
  stone(120, -190, 80, 190); roof(120, -190, 80, 90);
  stone(-60, -250, 120, 140); roof(-60, -250, 120, 120); // keep
  c.fillStyle = '#3a2416'; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-34, -56); c.arc(0, -56, 34, Math.PI, 0); c.lineTo(34, 0); c.fill();
  c.strokeStyle = '#ffd23f'; c.lineWidth = 3; for (let x = -24; x <= 24; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -70); c.stroke(); }
  c.fillStyle = '#ffcf6a';
  for (const [x, y] of [[-170, -150], [-170, -110], [150, -150], [150, -110], [-16, -210], [8, -210], [-16, -170], [8, -170]]) c.fillRect(x, y, 10, 16);
  // banners
  for (const x of [-90, 90]) { c.fillStyle = '#1a3a9a'; c.fillRect(x - 12, -110, 24, 50); M.poly(c, [x - 12, -60, x + 12, -60, x, -48]); c.fill(); c.fillStyle = '#ffd23f'; c.fillRect(x - 3, -104, 6, 34); }
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 400, (c, text) => {
    text('KEEP', 620, 160, {
      font: K.font(400, 150, 'Lilita One'), tracking: 0.06,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#9fd0ff'], [0.5, '#3f86ff'], [1, '#1d4fd6']]),
      outlines: [[30, NAVY], [12, '#ffd23f']], extrude: { dx: 0, dy: 10, steps: 10, color: NAVY },
      highlight: { color: 'rgba(255,255,255,0.45)', height: 0.38 },
    });
    text('DEFENDERS', 620, 352, {
      font: K.font(400, 212, 'Lilita One'), tracking: 0.02,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff7c2'], [0.45, '#ffd84a'], [1, '#e8931c']]),
      outlines: [[40, NAVY], [16, '#3f86ff']], extrude: { dx: 0, dy: 18, steps: 18, color: NAVY },
      highlight: { color: 'rgba(255,255,255,0.55)', height: 0.36 },
    });
  });
  const towerS = M.sprite(120, 230, s, (c) => { c.translate(60, 225); tower(c, 1); });
  const shot = M.glow(s, 16, [[0, 'rgba(255,255,220,1)'], [0.3, 'rgba(255,200,80,0.9)'], [1, 'rgba(255,120,20,0)']]);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Lilita One', px: 34, fill: '#ffe066', tracking: 0.1, padX: 36, padY: 10,
    plate: (x, pw, ph) => { K.roundRect(x, 3, 3, pw - 6, ph - 6, 14); x.fillStyle = 'rgba(13,31,92,0.9)'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffd23f'; x.stroke(); },
  });
  const N_EN = 9;

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 520, [[0, '#14257a'], [0.5, '#3e6fd6'], [0.85, '#ffb76b'], [1, '#ffd690']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.radGrad(ctx, 960, 470, 0, 420, [[0, 'rgba(255,230,160,0.8)'], [0.3, 'rgba(255,190,110,0.3)'], [1, 'rgba(255,170,90,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      // far ridges
      K.ridge(ctx, 1280, 720, 470, 70, '#6a74c4', 7, { step: 50, jag: 0.6 });
      K.ridge(ctx, 1280, 720, 500, 50, '#4a5aa8', 8, { step: 40, jag: 0.6 });
      // castle hill (right) + rolling ground
      ctx.beginPath(); ctx.moveTo(560, 720); ctx.quadraticCurveTo(820, 400, 960, 410); ctx.quadraticCurveTo(1140, 410, 1300, 520); ctx.lineTo(1300, 720); ctx.closePath();
      ctx.fillStyle = K.linGrad(ctx, 0, 400, 0, 720, [[0, '#5cbf4a'], [1, '#2f8a3a']]); ctx.fill();
      M.wavePath(ctx, 0, 1280, 560, [[22, 0.006, 1.4], [8, 0.02, 0.3]]);
      ctx.fillStyle = K.linGrad(ctx, 0, 520, 0, 720, [[0, '#62c64e'], [1, '#2c8236']]); ctx.fill();
      // path
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 56;
      ctx.beginPath(); PATH.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = '#d9b47a'; ctx.lineWidth = 42;
      ctx.beginPath(); PATH.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.save(); ctx.translate(960, 440); castle(ctx); ctx.restore();
      // trees
      const r = K.rng(12);
      for (let i = 0; i < 14; i++) {
        const x = r() * 1280, y = 540 + r() * 160;
        if (Math.abs(x - 640) < 70 && y > 600) continue;
        const k = 0.6 + (y - 540) / 260;
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 4 * k, y - 22 * k, 8 * k, 24 * k);
        ctx.fillStyle = '#2f8f45'; M.poly(ctx, [x - 26 * k, y - 18 * k, x + 26 * k, y - 18 * k, x, y - 78 * k]); ctx.fill();
        ctx.fillStyle = '#46b35a'; M.poly(ctx, [x - 20 * k, y - 40 * k, x + 20 * k, y - 40 * k, x, y - 90 * k]); ctx.fill();
      }
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.035, vignette: 0.4, vColor: '10,20,70' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // marching column
      const foes = [];
      for (let i = 0; i < N_EN; i++) {
        const u = M.wrap(0.04 + i / N_EN * 0.9 + t * 0.025, 0.02, 0.96);
        const [x, y] = along(u);
        const k = 0.55 + (y - 450) / 400;
        foes.push([x, y, k, i]);
        const hop = Math.abs(Math.sin(t * 8 + i)) * 4 * k;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 14 * k, 5 * k, 0, 0, K.TAU); ctx.fill();
        ctx.fillStyle = '#5a1f6b'; ctx.beginPath(); ctx.ellipse(x, y - 14 * k - hop, 13 * k, 15 * k, 0, 0, K.TAU); ctx.fill();
        ctx.fillStyle = '#ffde5a'; ctx.fillRect(x + 2 * k, y - 20 * k - hop, 4 * k, 4 * k); ctx.fillRect(x - 6 * k, y - 20 * k - hop, 4 * k, 4 * k);
      }
      // towers + their shots
      TOWERS.forEach(([tx, ty, k], i) => {
        ctx.drawImage(towerS, tx - 60 * k, ty - 225 * k, 120 * k, 230 * k);
        const period = 1.1 + i * 0.23, ph = M.wrap(t / period + i * 0.37, 0, 1);
        const target = foes[(Math.floor(t / period + i * 0.37) * 3 + i * 2) % N_EN];
        const sx = tx, sy = ty - 190 * k, ex = target[0], ey = target[1] - 14 * target[2];
        const arcH = 140 + i * 30;
        const pos = (u) => [K.lerp(sx, ex, u), K.lerp(sy, ey, u) - Math.sin(u * Math.PI) * arcH];
        // trail
        ctx.strokeStyle = 'rgba(255,214,110,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = 0; j <= 8; j++) { const u = Math.max(0, ph - 0.25 + j * 0.25 / 8); const [x, y] = pos(u); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        const [px, py] = pos(ph);
        M.put(ctx, shot, px, py);
        if (ph > 0.88) {
          const q = (ph - 0.88) / 0.12;
          ctx.globalAlpha = 1 - q;
          ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(ex, ey, 10 + q * 30, 0, K.TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
      const st = M.intro(t, 'drop', { t0: 0.0, dur: 0.34, dist: 420 });
      M.drawLogo(ctx, L, 640, 22, st, t, { ay: 0, shine: M.sweep(t, 0.7, 0.5, 4.8) });
      M.drawPrompt(ctx, prompt, 1050, 676, t, { t0: 0.55, hz: 1.2 });
      ctx.restore();
    },
  };
}
