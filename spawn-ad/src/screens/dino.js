// DINO RAMPAGE: dinosaur. Jungle at dusk, an erupting volcano with lava bombs and ash, a roaring T-rex silhouette;
// green/orange Anton logo over claw marks.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'dino', title: 'DINO RAMPAGE', word: 'dinosaur', aspect: 16 / 9 };

const INK = '#120805';
const CRATER = [990, 262];

function trex(c) {
  // classic side profile facing right, head raised in a roar; origin = feet
  const leg = (ox, k) => {
    c.save(); c.translate(ox, 0); c.scale(k, k);
    c.beginPath(); c.ellipse(10, -205, 62, 92, 0.25, 0, K.TAU); c.fill(); c.stroke();
    M.poly(c, [18, -140, 60, -128, 44, -22, 6, -28]); c.fill(); c.stroke();
    M.poly(c, [-14, 0, 84, 0, 90, -12, 62, -26, 4, -34]); c.fill(); c.stroke();
    c.restore();
  };
  leg(-74, 0.92);
  // tail, body and neck
  c.beginPath();
  c.moveTo(-450, -236);
  c.quadraticCurveTo(-250, -300, -80, -318);
  c.bezierCurveTo(0, -332, 70, -332, 122, -318);
  c.quadraticCurveTo(152, -310, 172, -352);
  c.lineTo(204, -342);
  c.quadraticCurveTo(176, -300, 164, -258);
  c.quadraticCurveTo(150, -198, 90, -180);
  c.quadraticCurveTo(0, -160, -70, -192);
  c.quadraticCurveTo(-200, -230, -450, -236);
  c.closePath(); c.fill(); c.stroke();
  // skull + upper jaw
  c.beginPath();
  c.moveTo(166, -350); c.lineTo(194, -402); c.quadraticCurveTo(232, -428, 292, -422);
  c.lineTo(348, -405); c.quadraticCurveTo(360, -396, 352, -384); c.lineTo(288, -372); c.lineTo(226, -360); c.closePath();
  c.fill(); c.stroke();
  // lower jaw, dropped open
  c.beginPath();
  c.moveTo(204, -346); c.lineTo(290, -338); c.lineTo(340, -314); c.quadraticCurveTo(344, -302, 330, -300);
  c.lineTo(266, -306); c.quadraticCurveTo(220, -308, 192, -326); c.closePath();
  c.fill(); c.stroke();
  leg(0, 1);
  // tiny arm
  c.lineWidth = 13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(150, -268); c.lineTo(178, -244); c.lineTo(190, -236); c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1260, 330, (c, text, fx) => {
    // claw marks behind
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x0 = 330 + i * 120;
      c.strokeStyle = '#3a0d06'; c.lineWidth = 46;
      c.beginPath(); c.moveTo(x0, 20); c.quadraticCurveTo(x0 + 250, 150, x0 + 560, 300); c.stroke();
      c.strokeStyle = '#c2381a'; c.lineWidth = 26;
      c.beginPath(); c.moveTo(x0, 20); c.quadraticCurveTo(x0 + 250, 150, x0 + 560, 300); c.stroke();
      c.strokeStyle = '#ff8a3a'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(x0 + 6, 18); c.quadraticCurveTo(x0 + 252, 146, x0 + 560, 292); c.stroke();
    }
    const font = K.font(400, 200, 'Anton');
    c.font = font;
    const wDino = c.measureText('DINO ').width, wAll = c.measureText('DINO RAMPAGE').width;
    const x0 = 630 - wAll / 2;
    for (const x2 of [c, fx]) { x2.save(); x2.translate(630, 250); x2.rotate(-0.035); x2.translate(-630, -250); }
    const base = { font, align: 'left', outlines: [[36, INK], [10, '#3d1a0a']], extrude: { dx: 4, dy: 16, steps: 16, color: INK }, highlight: { color: 'rgba(255,255,255,0.35)', height: 0.3 } };
    text('DINO', x0, 262, { ...base, fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#e2ff7a'], [0.5, '#5fd63a'], [1, '#1d7a2a']]) });
    text('RAMPAGE', x0 + wDino, 262, { ...base, fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff3a0'], [0.45, '#ffb02e'], [1, '#ff3d0f']]) });
    for (const x2 of [c, fx]) x2.restore();
  });
  const trexS = M.sprite(840, 460, s, (c) => {
    c.translate(470, 450); c.lineJoin = 'round';
    c.fillStyle = '#08130b'; c.strokeStyle = '#ff7a2a'; c.lineWidth = 8; trex(c);
    c.strokeStyle = 'rgba(0,0,0,0)'; c.lineWidth = 0.01; trex(c);
    // teeth, eye, brow
    c.fillStyle = '#f3e6c8';
    for (let i = 0; i < 6; i++) { const x = 236 + i * 19, y = -364 - i * 1.8; M.poly(c, [x, y, x + 10, y - 1, x + 5, y + 13]); c.fill(); }
    for (let i = 0; i < 5; i++) { const x = 228 + i * 20, y = -336 + i * 3.2; M.poly(c, [x, y, x + 10, y + 1, x + 5, y - 12]); c.fill(); }
    c.fillStyle = '#ffcf3a'; c.beginPath(); c.ellipse(244, -398, 8, 5, -0.3, 0, K.TAU); c.fill();
    c.fillStyle = '#08130b'; M.poly(c, [228, -410, 262, -414, 256, -404]); c.fill();
  });
  const fern = M.sprite(420, 320, s, (c) => {
    c.translate(0, 320); c.fillStyle = '#05100a';
    for (const [a, l] of [[-1.3, 300], [-1.0, 330], [-0.7, 300], [-0.45, 260], [-0.2, 220]]) {
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(0, -8);
      for (let k = 0; k <= 12; k++) { const u = k / 12; c.lineTo(u * l, -8 - Math.sin(u * Math.PI) * 26 - (k % 2 ? 14 : 0)); }
      for (let k = 12; k >= 0; k--) { const u = k / 12; c.lineTo(u * l, 8 + Math.sin(u * Math.PI) * 26 + (k % 2 ? 14 : 0)); }
      c.closePath(); c.fill();
      c.restore();
    }
  });
  const fernR = M.sprite(420, 320, s, (c) => { c.translate(420, 0); c.scale(-1, 1); c.drawImage(fern, 0, 0, 420, 320); });
  const bomb = M.glow(s, 14, [[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,150,40,0.95)'], [1, 'rgba(255,60,0,0)']]);
  const craterGlow = M.glow(s, 180, [[0, 'rgba(255,170,60,0.75)'], [0.4, 'rgba(255,90,20,0.3)'], [1, 'rgba(255,60,0,0)']]);
  const prompt = M.makePrompt(s, 'PRESS START', { font: 'Anton', px: 38, fill: '#ffd23f', stroke: INK, strokeW: 5, tracking: 0.2, padY: 8 });
  const bombs = M.field(14, 111), ash = M.field(40, 112);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 560, [[0, '#1c0a0c'], [0.4, '#5a1a14'], [0.75, '#c2441c'], [1, '#ff8a2a']]);
      ctx.fillRect(0, 0, 1280, 720);
      // plume
      const r = K.rng(3);
      for (let i = 0; i < 26; i++) {
        const u = i / 26, x = CRATER[0] - 20 + Math.sin(u * 5) * 60 + (r() - 0.5) * 60 - u * 160, y = CRATER[1] - 20 - u * 300, rad = 50 + u * 110 + r() * 30;
        ctx.fillStyle = `rgba(${(40 + 30 * (1 - u)) | 0},${(18 + 10 * (1 - u)) | 0},${(20) | 0},0.9)`;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, K.TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,110,30,${(0.35 * (1 - u)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y + rad * 0.45, rad * 0.6, 0, K.TAU); ctx.fill();
      }
      // volcano
      ctx.fillStyle = K.linGrad(ctx, 700, 0, 1280, 0, [[0, '#3a1a14'], [1, '#1c0c0a']]);
      M.poly(ctx, [640, 560, 900, 300, 950, 262, 1030, 262, 1080, 300, 1320, 560]); ctx.fill();
      // lava streams
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [pts, lw] of [[[960, 266, 930, 330, 945, 390, 900, 470, 880, 560], 10], [[1010, 266, 1040, 340, 1020, 410, 1070, 500, 1090, 560], 8], [[985, 266, 990, 330, 975, 380], 6]]) {
        ctx.strokeStyle = 'rgba(255,90,20,0.45)'; ctx.lineWidth = lw * 2.4; M.poly(ctx, pts, false); ctx.stroke();
        ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = lw; M.poly(ctx, pts, false); ctx.stroke();
      }
      // jungle line
      ctx.fillStyle = '#16301c';
      for (let x = -30; x < 1320; x += 52) { ctx.beginPath(); ctx.arc(x, 520 + (x * 13 % 30), 46, 0, K.TAU); ctx.fill(); }
      ctx.fillRect(0, 520, 1280, 200);
      // palms
      for (const [x, y, hh, lean] of [[120, 560, 260, -30], [560, 540, 220, 20], [1180, 560, 250, -40], [760, 560, 180, 30]]) {
        ctx.strokeStyle = '#0d2014'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - hh * 0.6, x + lean, y - hh); ctx.stroke();
        ctx.fillStyle = '#0d2014';
        for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.55; ctx.beginPath(); ctx.ellipse(x + lean + Math.cos(a) * 60, y - hh + Math.sin(a) * 26 + 20, 66, 12, a, 0, K.TAU); ctx.fill(); }
      }
      ctx.fillStyle = K.linGrad(ctx, 0, 560, 0, 720, [[0, '#0f2416'], [1, '#07120b']]); ctx.fillRect(0, 590, 1280, 130);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.06, vignette: 0.5, vColor: '30,5,0' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5) * Math.sin(t * 3.1);
      M.put(ctx, craterGlow, CRATER[0], CRATER[1]);
      ctx.globalAlpha = 1;
      // lava bombs
      for (const b of bombs) {
        const life = M.wrap(t * (0.45 + b.a * 0.3) + b.b, 0, 1);
        const vx = (b.c - 0.5) * 520, vy = -380 - b.d * 260, tt = life * 1.6;
        const x = CRATER[0] + vx * tt, y = CRATER[1] + vy * tt + 0.5 * 520 * tt * tt;
        if (y > 560) continue;
        ctx.globalAlpha = 1 - life * 0.6;
        const sc = 0.6 + b.e * 0.8;
        ctx.drawImage(bomb, x - 14 * sc, y - 14 * sc, 28 * sc, 28 * sc);
      }
      ctx.globalAlpha = 1;
      // the T-rex breathing
      ctx.save(); ctx.translate(330, 694); ctx.scale(0.86, 0.86 + Math.sin(t * 2.2) * 0.007);
      ctx.drawImage(trexS, -470, -450, 840, 460);
      ctx.restore();
      // foreground ferns swaying
      for (const [x, flip, ph] of [[-30, 1, 0], [1310, -1, 1.3]]) {
        const dx = Math.round(Math.sin(t * 1.1 + ph) * 6 * s) / s;
        if (flip > 0) M.blit(ctx, fern, x + dx, 400, s);
        else M.blit(ctx, fernR, x + dx - 420, 400, s);
      }
      // ash
      for (const a of ash) {
        const x = M.wrap(a.a * 1280 - t * (20 + a.b * 30), 0, 1280), y = M.wrap(a.c * 720 + t * (30 + a.d * 40), 0, 720);
        ctx.fillStyle = a.e < 0.3 ? 'rgba(255,150,60,0.8)' : 'rgba(200,170,160,0.45)';
        ctx.fillRect(x, y, 3 + a.f * 3, 3);
      }
      const st = M.intro(t, 'slam', { t0: 0.03, dur: 0.24, from: 1.5 });
      const [sx, sy] = M.shake(t, 0.28, 0.38, 18, 13);
      M.drawLogo(ctx, L, 640 + sx, 150 + sy, st, t, { bob: [2.5, 0.4], shine: M.sweep(t, 0.7, 0.45, 4.8) });
      M.drawPrompt(ctx, prompt, 640, 682, t, { t0: 0.55, hz: 1.3 });
      ctx.restore();
    },
  };
}
