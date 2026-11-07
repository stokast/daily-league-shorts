// EMBERDEEP: dungeon. Dark stone archway, torchlight, glowing runes, a sword in the stone; gold/ember Cinzel logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'dungeon', title: 'EMBERDEEP', word: 'dungeon', aspect: 16 / 9 };

const CX = 640, FLOOR = 640, SPRING = 340, RIN = 186, ROUT = 262;
const TORCHES = [[262, 318], [1018, 318]];
const RUNE_ANG = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92];

function stoneBlock(c, x, y, ww, hh, r) {
  const v = 38 + r() * 14;
  c.fillStyle = `rgb(${v},${v - 3},${v + 8})`;
  c.fillRect(x + 2, y + 2, ww - 4, hh - 4);
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 2, y + 2, ww - 4, 4);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 2, y + hh - 7, ww - 4, 5);
}

function glyph(c, seed) {
  const r = K.rng(seed);
  c.beginPath();
  c.moveTo(0, -18); c.lineTo(0, 18);
  for (let i = 0; i < 3; i++) {
    const y0 = -16 + r() * 32, d = r() < 0.5 ? -1 : 1;
    c.moveTo(0, y0); c.lineTo(d * (8 + r() * 6), y0 + (r() - 0.5) * 18);
  }
  if (r() < 0.5) { c.moveTo(-8, -10); c.lineTo(8, 0); }
  c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1270, 300, (c, text) => {
    text('EMBERDEEP', 635, 196, {
      font: K.font(900, 166, 'Cinzel Decorative'),
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff7cf'], [0.38, '#ffd56a'], [0.52, '#f0a032'], [0.78, '#a9561a'], [1, '#e6a04a']]),
      outlines: [[28, '#130703'], [10, '#7c3b0c']],
      extrude: { dx: 0, dy: 10, steps: 10, color: '#0c0402' },
      glow: { color: 'rgba(255,110,24,0.95)', blur: 46 },
      highlight: { color: 'rgba(255,255,230,0.4)', height: 0.28 },
    });
    // flourish rule under the title
    c.strokeStyle = '#e8a640'; c.lineWidth = 4;
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(635 + d * 60, 252); c.lineTo(635 + d * 300, 252); c.stroke(); }
    c.fillStyle = '#ffd56a';
    c.beginPath(); c.moveTo(635, 238); c.lineTo(651, 252); c.lineTo(635, 266); c.lineTo(619, 252); c.closePath(); c.fill();
    c.lineWidth = 3; c.strokeStyle = '#130703'; c.stroke();
  });
  const runeS = RUNE_ANG.map((_, i) => M.sprite(70, 80, s, (c) => {
    c.translate(35, 40);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,120,30,0.35)'; c.lineWidth = 12; glyph(c, 40 + i);
    c.strokeStyle = 'rgba(255,170,60,0.8)'; c.lineWidth = 6; glyph(c, 40 + i);
    c.strokeStyle = '#fff1b0'; c.lineWidth = 2.5; glyph(c, 40 + i);
  }));
  const ember = M.glow(s, 9, [[0, 'rgba(255,240,180,1)'], [0.35, 'rgba(255,150,40,0.85)'], [1, 'rgba(255,90,10,0)']]);
  const torchGlow = M.glow(s, 170, [[0, 'rgba(255,170,70,0.5)'], [0.4, 'rgba(255,110,30,0.2)'], [1, 'rgba(255,80,20,0)']]);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Cinzel Decorative', weight: 700, px: 30, fill: '#ffd36b', tracking: 0.22, padX: 60, padY: 8,
    plate: (x, pw, ph) => {
      x.fillStyle = '#e8a640';
      for (const cx of [22, pw - 22]) { x.beginPath(); x.moveTo(cx, ph / 2 - 8); x.lineTo(cx + 8, ph / 2); x.lineTo(cx, ph / 2 + 8); x.lineTo(cx - 8, ph / 2); x.fill(); }
    },
  });
  const embers = M.field(42, 71);

  const flame = (ctx, x, y, t, ph) => {
    const k = 1 + 0.16 * Math.sin(t * 13 + ph) + 0.09 * Math.sin(t * 23.7 + ph * 2);
    const sway = Math.sin(t * 7.3 + ph) * 5;
    for (const [hh, ww, col] of [[86, 30, '#ff5a14'], [64, 21, '#ffae2e'], [38, 12, '#fff3b0']]) {
      const H = hh * k;
      ctx.beginPath();
      ctx.moveTo(x - ww, y);
      ctx.quadraticCurveTo(x - ww * 1.1, y - H * 0.45, x + sway, y - H);
      ctx.quadraticCurveTo(x + ww * 1.1, y - H * 0.45, x + ww, y);
      ctx.quadraticCurveTo(x, y + ww * 0.8, x - ww, y);
      ctx.fillStyle = col; ctx.fill();
    }
  };

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = '#121118'; ctx.fillRect(0, 0, 1280, 720);
      // stone wall
      const r = K.rng(3);
      for (let row = 0, y = -20; y < FLOOR; row++, y += 58) {
        let x = -((row * 53) % 110);
        while (x < 1280) { const ww = 90 + r() * 60; stoneBlock(ctx, x, y, ww, 58, r); x += ww; }
      }
      // torch light pools on the wall
      for (const [tx, ty] of TORCHES) {
        ctx.fillStyle = K.radGrad(ctx, tx, ty - 40, 0, 330, [[0, 'rgba(255,150,60,0.45)'], [0.5, 'rgba(255,100,30,0.15)'], [1, 'rgba(255,80,20,0)']]);
        ctx.fillRect(tx - 340, ty - 380, 680, 760);
      }
      // archway opening
      ctx.save();
      ctx.beginPath(); ctx.moveTo(CX - RIN, FLOOR); ctx.lineTo(CX - RIN, SPRING); ctx.arc(CX, SPRING, RIN, Math.PI, 0); ctx.lineTo(CX + RIN, FLOOR); ctx.closePath();
      ctx.fillStyle = '#050407'; ctx.fill();
      ctx.clip();
      // stairs descending into ember light
      for (let i = 0; i < 9; i++) {
        const y0 = FLOOR - i * 24, hh = 24 - i * 1.4, ww = RIN * 2 - i * 22;
        const lit = 1 - i / 9;
        ctx.fillStyle = `rgba(${(120 * lit + 20) | 0},${(60 * lit + 10) | 0},${(30 * lit + 12) | 0},1)`;
        ctx.fillRect(CX - ww / 2, y0 - hh, ww, hh);
        ctx.fillStyle = `rgba(255,${(140 + 60 * lit) | 0},80,${(0.35 * lit).toFixed(3)})`;
        ctx.fillRect(CX - ww / 2, y0 - hh, ww, 3);
      }
      ctx.fillStyle = K.radGrad(ctx, CX, FLOOR + 40, 10, 330, [[0, 'rgba(255,120,30,0.75)'], [0.5, 'rgba(200,60,10,0.25)'], [1, 'rgba(120,20,0,0)']]);
      ctx.fillRect(CX - RIN, SPRING - RIN, RIN * 2, FLOOR);
      ctx.restore();
      // jambs
      for (const side of [-1, 1]) {
        for (let y = SPRING; y < FLOOR; y += 62) {
          const x0 = side < 0 ? CX - ROUT : CX + RIN;
          ctx.fillStyle = '#0b0a10'; ctx.fillRect(x0, y, ROUT - RIN, 62);
          stoneBlock(ctx, x0 + 1, y + 1, ROUT - RIN - 2, 60, r);
        }
      }
      // voussoirs
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
        ctx.beginPath();
        ctx.arc(CX, SPRING, ROUT + (i === 6 ? 22 : 0), a0, a1); ctx.arc(CX, SPRING, RIN, a1, a0, true); ctx.closePath();
        ctx.fillStyle = '#0b0a10'; ctx.fill();
        ctx.save(); ctx.clip();
        const v = 54 + r() * 14;
        ctx.fillStyle = `rgb(${v},${v - 4},${v + 6})`;
        ctx.beginPath(); ctx.arc(CX, SPRING, ROUT + (i === 6 ? 20 : -2), a0 + 0.012, a1 - 0.012); ctx.arc(CX, SPRING, RIN + 2, a1 - 0.012, a0 + 0.012, true); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // floor
      ctx.fillStyle = K.linGrad(ctx, 0, FLOOR, 0, 720, [[0, '#2b2731'], [1, '#141219']]);
      ctx.fillRect(0, FLOOR, 1280, 80);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3;
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(CX + i * 60, FLOOR); ctx.lineTo(CX + i * 150, 720); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, FLOOR + 28); ctx.lineTo(1280, FLOOR + 28); ctx.stroke();
      ctx.fillStyle = K.radGrad(ctx, CX, FLOOR, 0, 380, [[0, 'rgba(255,120,40,0.35)'], [1, 'rgba(255,90,20,0)']]);
      ctx.fillRect(0, FLOOR - 40, 1280, 120);
      // torch brackets
      for (const [tx, ty] of TORCHES) {
        ctx.fillStyle = '#17120f'; ctx.fillRect(tx - 7, ty, 14, 90);
        M.poly(ctx, [tx - 24, ty - 6, tx + 24, ty - 6, tx + 14, ty + 22, tx - 14, ty + 22]); ctx.fill();
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(tx - 5, ty + 2, 10, 24);
      }
      // sword in the stone
      ctx.fillStyle = '#1c1a22';
      M.poly(ctx, [CX - 120, FLOOR + 6, CX - 96, FLOOR - 44, CX - 40, FLOOR - 66, CX + 52, FLOOR - 62, CX + 104, FLOOR - 36, CX + 126, FLOOR + 6]); ctx.fill();
      ctx.fillStyle = '#3a3542';
      M.poly(ctx, [CX - 96, FLOOR - 44, CX - 40, FLOOR - 66, CX + 52, FLOOR - 62, CX + 104, FLOOR - 36, CX + 40, FLOOR - 40, CX - 30, FLOOR - 36]); ctx.fill();
      const by0 = 418, by1 = FLOOR - 52;
      M.poly(ctx, [CX - 19, by0, CX + 19, by0, CX + 15, by1, CX - 15, by1]);
      ctx.fillStyle = K.linGrad(ctx, CX - 19, 0, CX + 19, 0, [[0, '#7d8494'], [0.48, '#e8edf5'], [0.52, '#9aa2b2'], [1, '#4a505e']]); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0d0c12'; ctx.stroke();
      K.roundRect(ctx, CX - 92, 398, 184, 22, 10);
      ctx.fillStyle = K.linGrad(ctx, 0, 398, 0, 420, [[0, '#ffe08a'], [1, '#a8641c']]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2216'; ctx.fillRect(CX - 12, 330, 24, 70); ctx.strokeRect(CX - 12, 330, 24, 70);
      ctx.strokeStyle = '#a8641c'; ctx.lineWidth = 3;
      for (let y = 338; y < 396; y += 10) { ctx.beginPath(); ctx.moveTo(CX - 12, y); ctx.lineTo(CX + 12, y + 6); ctx.stroke(); }
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.06, vignette: 0.6 });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // torches
      for (let i = 0; i < 2; i++) {
        const [tx, ty] = TORCHES[i];
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 11 + i * 2) * Math.sin(t * 7.1 + i);
        M.put(ctx, torchGlow, tx, ty - 40);
        ctx.globalAlpha = 1;
        flame(ctx, tx, ty + 2, t, i * 2.3);
      }
      // runes on the arch pulse in sequence
      RUNE_ANG.forEach((f, i) => {
        const a = Math.PI + f * Math.PI, rr = (RIN + ROUT) / 2;
        const x = CX + Math.cos(a) * rr, y = SPRING + Math.sin(a) * rr;
        ctx.globalAlpha = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 - i * 0.9), 2);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.drawImage(runeS[i], -35 * 0.7, -40 * 0.7, 70 * 0.7, 80 * 0.7);
        ctx.restore();
      });
      // pommel gem
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3);
      M.put(ctx, ember, CX, 322);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(CX, 322, 11, 0, K.TAU); ctx.fill();
      ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(CX - 3, 319, 4, 0, K.TAU); ctx.fill();
      // embers rising
      for (const e of embers) {
        const life = M.wrap(t * (0.16 + e.b * 0.18) + e.a, 0, 1);
        const x = 380 + e.c * 520 + Math.sin(t * (1 + e.d) + e.e * 6) * 30 * life;
        const y = 690 - life * 640;
        ctx.globalAlpha = Math.sin(life * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + e.f * 9));
        const sc = 0.5 + e.e * 0.9;
        ctx.drawImage(ember, x - 9 * sc, y - 9 * sc, 18 * sc, 18 * sc);
      }
      ctx.globalAlpha = 1;
      // logo
      const st = M.intro(t, 'rise', { t0: 0.03, dur: 0.32, dist: 140 });
      M.drawLogo(ctx, L, 640, 214, st, t, { breathe: [0.006, 0.4], shine: M.sweep(t, 0.6, 0.6, 5), shineOpts: { color: '255,240,200', alpha: 0.7 } });
      M.drawPrompt(ctx, prompt, 640, 688, t, { t0: 0.55, mode: 'pulse', hz: 0.7 });
      ctx.restore();
    },
  };
}
