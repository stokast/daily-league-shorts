// SIZZLE SQUAD: cooking. Teal tiled kitchen, checkered floor, a stove with flames and steam, pans and food
// flying everywhere; orange Bungee logo that flips in like a pancake.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'cooking', title: 'SIZZLE SQUAD', word: 'cooking', aspect: 16 / 9 };

const BROWN = '#3b1206';

const FOODS = {
  pan(c) {
    c.lineCap = 'round';
    c.strokeStyle = BROWN; c.lineWidth = 22; c.beginPath(); c.moveTo(40, 0); c.lineTo(120, 0); c.stroke();
    c.strokeStyle = '#8a4a22'; c.lineWidth = 12; c.beginPath(); c.moveTo(48, 0); c.lineTo(116, 0); c.stroke();
    c.beginPath(); c.arc(0, 0, 54, 0, K.TAU); c.fillStyle = '#2a2a33'; c.fill(); c.lineWidth = 7; c.strokeStyle = BROWN; c.stroke();
    c.beginPath(); c.arc(0, 0, 40, 0, K.TAU); c.fillStyle = '#3f3f4c'; c.fill();
    // fried egg in the pan
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-4, 2, 30, 24, 0.3, 0, K.TAU); c.fill();
    c.fillStyle = '#ffb21f'; c.beginPath(); c.arc(-2, 0, 11, 0, K.TAU); c.fill();
  },
  tomato(c) {
    c.beginPath(); c.arc(0, 0, 34, 0, K.TAU); c.fillStyle = K.radGrad(c, -10, -12, 4, 40, [[0, '#ff8a7a'], [1, '#e0201c']]); c.fill();
    c.lineWidth = 6; c.strokeStyle = BROWN; c.stroke();
    c.fillStyle = '#2fa84f';
    for (let i = 0; i < 5; i++) { c.save(); c.translate(0, -30); c.rotate(i * 1.25); c.beginPath(); c.ellipse(0, -9, 5, 12, 0, 0, K.TAU); c.fill(); c.restore(); }
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(-12, -12, 8, 5, -0.7, 0, K.TAU); c.fill();
  },
  carrot(c) {
    M.poly(c, [-14, -40, 14, -40, 0, 52]); c.fillStyle = '#ff8a1f'; c.fill(); c.lineWidth = 6; c.strokeStyle = BROWN; c.lineJoin = 'round'; c.stroke();
    c.strokeStyle = '#c95f10'; c.lineWidth = 3; for (const y of [-20, 0, 20]) { c.beginPath(); c.moveTo(-8 + (y + 40) * 0.1, y); c.lineTo(2, y + 4); c.stroke(); }
    c.fillStyle = '#2fa84f'; for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(0, -40); c.rotate(a); c.beginPath(); c.ellipse(0, -16, 6, 18, 0, 0, K.TAU); c.fill(); c.restore(); }
  },
  cheese(c) {
    M.poly(c, [-44, 26, 44, 26, 44, -6, -30, -30]); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 6; c.strokeStyle = BROWN; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = '#e8a71a'; for (const [x, y, r] of [[-10, 8, 7], [18, 12, 5], [26, -4, 4], [-24, -6, 4]]) { c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.fill(); }
  },
  drumstick(c) {
    c.beginPath(); c.ellipse(-10, 0, 40, 30, -0.3, 0, K.TAU); c.fillStyle = '#c9732e'; c.fill(); c.lineWidth = 6; c.strokeStyle = BROWN; c.stroke();
    c.fillStyle = 'rgba(255,220,160,0.5)'; c.beginPath(); c.ellipse(-20, -10, 16, 8, -0.4, 0, K.TAU); c.fill();
    c.strokeStyle = BROWN; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, 10); c.lineTo(52, 22); c.stroke();
    c.strokeStyle = '#fff4e0'; c.lineWidth = 8; c.beginPath(); c.moveTo(24, 10); c.lineTo(52, 22); c.stroke();
    c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(56, 18, 8, 0, K.TAU); c.arc(52, 28, 8, 0, K.TAU); c.fill();
  },
  pancakes(c) {
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 14 - i * 14, 46, 14, 0, 0, K.TAU); c.fillStyle = '#e8a04a'; c.fill(); c.lineWidth = 5; c.strokeStyle = BROWN; c.stroke(); }
    c.fillStyle = '#ffe58a'; c.fillRect(-10, -26, 20, 10); c.strokeRect(-10, -26, 20, 10);
    c.fillStyle = '#8a3a10'; c.beginPath(); c.ellipse(0, -16, 30, 8, 0, 0, K.TAU); c.fill();
  },
  mushroom(c) {
    c.fillStyle = '#fff1dc'; K.roundRect(c, -14, -6, 28, 40, 8); c.fill(); c.lineWidth = 5; c.strokeStyle = BROWN; c.stroke();
    c.beginPath(); c.arc(0, -4, 40, Math.PI, 0); c.closePath(); c.fillStyle = '#e34a3a'; c.fill(); c.stroke();
    c.fillStyle = '#fff'; for (const [x, y, r] of [[-18, -18, 7], [10, -28, 6], [22, -12, 5]]) { c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.fill(); }
  },
};
// flying items: [kind, centre x, centre y, orbit rx, ry, speed, spin, phase, scale]
const FLY = [
  ['pan', 128, 266, 26, 22, 0.9, 2.2, 0.0, 1.3],
  ['tomato', 1168, 128, 24, 26, 1.1, -3.1, 1.2, 1.25],
  ['carrot', 1182, 332, 26, 20, 0.8, 2.6, 2.4, 1.2],
  ['cheese', 116, 470, 24, 18, 1.0, -2.0, 3.1, 1.2],
  ['drumstick', 96, 88, 26, 16, 1.2, 3.4, 0.7, 1.05],
  ['pancakes', 1130, 520, 24, 16, 0.9, -1.6, 1.9, 1.1],
  ['mushroom', 330, 590, 22, 18, 1.3, 2.9, 2.8, 1.0],
];

export function create(w, h) {
  const s = w / 1280;
  const orange = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#ffe08a'], [0.45, '#ffa22e'], [1, '#ff5a00']]);
  const L = M.makeLogo(s, 1240, 430, (c, text, fx) => {
    const r1 = text('SIZZLE', 640, 206, { font: K.font(400, 176, 'Bungee'), fill: orange, tracking: 0.02, outlines: [[38, BROWN], [14, '#ffffff']], extrude: { dx: 0, dy: 14, steps: 14, color: BROWN }, highlight: { color: 'rgba(255,255,255,0.5)', height: 0.36 } });
    for (const x2 of [c, fx]) { x2.save(); x2.translate(640, 380); x2.rotate(-0.05); }
    text('SQUAD', 0, 0, { font: K.font(400, 222, 'Bungee'), fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff2b0'], [0.5, '#ff7a1a'], [1, '#e8380c']]), tracking: 0.03, outlines: [[40, BROWN], [14, '#ffffff']], extrude: { dx: 6, dy: 16, steps: 16, color: BROWN }, highlight: { color: 'rgba(255,255,255,0.5)', height: 0.34 } });
    for (const x2 of [c, fx]) x2.restore();
    // chef's hat on the K
    c.save(); c.translate(640 - r1.width / 2 + 36, 44); c.rotate(-0.28);
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-40, 20); c.lineTo(-40, -10);
    c.arc(-28, -26, 24, Math.PI * 0.8, Math.PI * 1.7); c.arc(4, -40, 30, Math.PI * 1.1, Math.PI * 1.95); c.arc(32, -20, 22, Math.PI * 1.4, Math.PI * 0.3);
    c.lineTo(40, 20); c.closePath();
    c.fillStyle = '#fbfbff'; c.fill(); c.lineWidth = 8; c.strokeStyle = BROWN; c.stroke();
    c.fillStyle = '#e9ebf5'; c.fillRect(-40, 4, 80, 16); c.strokeRect(-40, 4, 80, 16);
    c.restore();
  });
  // tight sprites: [width, height, origin x, origin y] per item
  const BOX = { pan: [200, 124, 62, 62], tomato: [84, 104, 42, 58], carrot: [70, 140, 35, 76], cheese: [104, 72, 52, 38], drumstick: [146, 84, 58, 40], pancakes: [104, 76, 52, 40], mushroom: [92, 90, 46, 50] };
  const foodS = {};
  for (const k of Object.keys(FOODS)) { const [bw, bh, ox, oy] = BOX[k]; foodS[k] = M.sprite(bw, bh, s, (c) => { c.translate(ox, oy); FOODS[k](c); }); }
  const steam = M.glow(s, 60, [[0, 'rgba(255,255,255,0.75)'], [0.55, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Bungee', px: 30, fill: BROWN, tracking: 0.08, padX: 30, padY: 16,
    plate: (x, pw, ph) => {
      x.fillStyle = '#fff8ea'; x.beginPath(); x.moveTo(4, 4); x.lineTo(pw - 4, 4); x.lineTo(pw - 4, ph - 8);
      for (let px = pw - 4; px > 4; px -= 14) { x.lineTo(px - 7, ph - 2); x.lineTo(px - 14, ph - 8); }
      x.closePath(); x.fill(); x.fillStyle = '#ff5a00'; x.fillRect(4, 4, pw - 8, 8);
    },
  });
  const puffs = M.field(7, 91);
  const POT = [640, 520];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      // teal tiled wall
      ctx.fillStyle = '#1f9e95'; ctx.fillRect(0, 0, 1280, 470);
      for (let y = 0, row = 0; y < 470; y += 40, row++) {
        for (let x = row % 2 ? -40 : 0; x < 1280; x += 80) {
          ctx.fillStyle = (x / 80 + row) % 3 < 1 ? '#27aca2' : '#22a59b';
          ctx.fillRect(x + 3, y + 3, 74, 34);
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 5, y + 5, 70, 5);
        }
      }
      ctx.fillStyle = K.radGrad(ctx, 640, 260, 60, 700, [[0, 'rgba(255,220,150,0.35)'], [1, 'rgba(255,200,120,0)']]);
      ctx.fillRect(0, 0, 1280, 470);
      // shelf with jars + hanging utensils
      ctx.fillStyle = '#6b3a1e'; ctx.fillRect(40, 300, 260, 16); ctx.fillRect(980, 300, 260, 16);
      for (const [x, col] of [[70, '#ff6f61'], [130, '#ffd23f'], [190, '#9b5cff'], [1010, '#ff8a1f'], [1080, '#ff6f61'], [1150, '#ffffff']]) {
        ctx.fillStyle = col; K.roundRect(ctx, x, 248, 46, 52, 8); ctx.fill();
        ctx.fillStyle = '#6b3a1e'; ctx.fillRect(x + 4, 240, 38, 10);
      }
      ctx.strokeStyle = '#c9d1dc'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(380, 30); ctx.lineTo(900, 30); ctx.stroke();
      for (const x of [420, 860]) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 120); ctx.stroke(); }
      // counter + stove
      ctx.fillStyle = '#d4d9e2'; ctx.fillRect(0, 470, 1280, 20);
      ctx.fillStyle = K.linGrad(ctx, 0, 490, 0, 560, [[0, '#9aa3b2'], [1, '#6c7484']]); ctx.fillRect(0, 490, 1280, 70);
      ctx.fillStyle = '#4a505e'; for (let x = 60; x < 1280; x += 220) { ctx.fillRect(x, 506, 160, 40); ctx.fillStyle = '#c9d1dc'; ctx.fillRect(x + 64, 520, 32, 6); ctx.fillStyle = '#4a505e'; }
      // pot on the stove
      ctx.fillStyle = '#2a2a33'; K.roundRect(ctx, POT[0] - 90, POT[1] - 70, 180, 80, 14); ctx.fill();
      ctx.fillStyle = '#c9d1dc'; K.roundRect(ctx, POT[0] - 84, POT[1] - 66, 168, 70, 12); ctx.fill();
      ctx.fillStyle = '#9aa3b2'; ctx.fillRect(POT[0] - 84, POT[1] - 30, 168, 8);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(POT[0] - 110, POT[1] - 60, 24, 12); ctx.fillRect(POT[0] + 86, POT[1] - 60, 24, 12);
      // checkered floor in perspective
      ctx.save(); ctx.beginPath(); ctx.rect(0, 560, 1280, 160); ctx.clip();
      ctx.fillStyle = '#f3e3cc'; ctx.fillRect(0, 560, 1280, 160);
      const vx = 640, vy = 300, rows = [560, 584, 614, 652, 700, 760];
      for (let j = 0; j < rows.length - 1; j++) {
        const y0 = rows[j], y1 = rows[j + 1];
        for (let i = -16; i < 16; i++) {
          if ((i + j) % 2 === 0) continue;
          const xa = (yy, ii) => vx + (ii * 90) * (yy - vy) / (560 - vy) * 0.55;
          M.poly(ctx, [xa(y0, i), y0, xa(y0, i + 1), y0, xa(y1, i + 1), y1, xa(y1, i), y1]);
          ctx.fillStyle = '#d6332b'; ctx.fill();
        }
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 558, 1280, 6);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.035, vignette: 0.42, vColor: '40,10,0' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // burner flames under the pot
      for (let i = -2; i <= 2; i++) {
        const fh = 18 + 8 * Math.sin(t * 17 + i * 1.7) + 5 * Math.sin(t * 29 + i);
        const x = POT[0] + i * 26, y = POT[1] + 18;
        ctx.fillStyle = '#3aa8ff'; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x, y - fh * 1.6, x + 9, y); ctx.fill();
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - fh, x + 5, y); ctx.fill();
      }
      // steam from the pot
      for (const p of puffs) {
        const life = M.wrap(t * (0.35 + p.a * 0.2) + p.b, 0, 1);
        const x = POT[0] + (p.c - 0.5) * 120 + Math.sin(t * 2 + p.d * 6) * 20 * life;
        const y = POT[1] - 80 - life * 260;
        const sc = 0.5 + life * 1.3;
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.75;
        ctx.drawImage(steam, x - 60 * sc, y - 60 * sc, 120 * sc, 120 * sc);
      }
      ctx.globalAlpha = 1;
      // flying food
      for (const [k, cx, cy, rx, ry, sp, spin, ph, sc] of FLY) {
        const a = t * sp + ph;
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a * 1.3) * ry;
        const [bw, bh, ox, oy] = BOX[k];
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * spin + ph); ctx.scale(sc, sc);
        ctx.drawImage(foodS[k], -ox, -oy, bw, bh);
        ctx.restore();
      }
      const st = M.intro(t, 'flip', { t0: 0.03, dur: 0.32, dist: 110 });
      M.drawLogo(ctx, L, 640, 232, st, t, { bob: [4, 0.45], shine: M.sweep(t, 0.6, 0.45, 4.4) });
      M.drawPrompt(ctx, prompt, 640, 658, t, { t0: 0.55, hz: 1.3 });
      ctx.restore();
    },
  };
}
