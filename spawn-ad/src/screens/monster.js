// CRITTER QUEST: monster taming. Sunny meadow, three original critters (a jelly blob, a fox-like pup, a fluffy bird);
// green/yellow Titan One logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'monster', title: 'CRITTER QUEST', word: 'monster taming', aspect: 16 / 9 };

const DEEP = '#0f4a2a';

function eyes(c, x, y, r, gap, closed, col = '#1b1530') {
  for (const ex of [x - gap, x + gap]) {
    if (closed) {
      c.lineWidth = r * 0.45; c.lineCap = 'round'; c.strokeStyle = col;
      c.beginPath(); c.arc(ex, y - r * 0.2, r * 0.75, 0.2, Math.PI - 0.2); c.stroke();
    } else {
      c.fillStyle = col; c.beginPath(); c.ellipse(ex, y, r * 0.82, r, 0, 0, K.TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - r * 0.28, y - r * 0.38, r * 0.34, 0, K.TAU); c.fill();
      c.beginPath(); c.arc(ex + r * 0.3, y + r * 0.35, r * 0.15, 0, K.TAU); c.fill();
    }
  }
}
function cheeks(c, x, y, gap, r) {
  c.fillStyle = 'rgba(255,110,140,0.55)';
  for (const ex of [x - gap, x + gap]) { c.beginPath(); c.ellipse(ex, y, r, r * 0.6, 0, 0, K.TAU); c.fill(); }
}

function blob(c, closed) {
  // mint jelly gumdrop with a leaf sprout; origin = bottom centre
  const body = () => {
    c.beginPath();
    c.moveTo(-82, -6);
    c.bezierCurveTo(-96, -70, -60, -150, 0, -152);
    c.bezierCurveTo(60, -150, 96, -70, 82, -6);
    c.quadraticCurveTo(0, 10, -82, -6); c.closePath();
  };
  c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,60,40,0.25)'; c.beginPath(); c.ellipse(0, 0, 90, 12, 0, 0, K.TAU); c.fill();
  // sprout
  c.strokeStyle = '#1b6f3a'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -148); c.quadraticCurveTo(4, -170, -2, -182); c.stroke();
  for (const d of [-1, 1]) {
    c.save(); c.translate(-2, -180); c.rotate(d * 0.9 - Math.PI / 2);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(16, -14, 38, 0); c.quadraticCurveTo(16, 14, 0, 0);
    c.fillStyle = '#6fe06a'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#1b6f3a'; c.stroke();
    c.restore();
  }
  body(); c.lineWidth = 9; c.strokeStyle = '#167a68'; c.stroke();
  body(); c.fillStyle = K.radGrad(c, -30, -100, 10, 170, [[0, '#a8ffe6'], [0.5, '#4fe0c0'], [1, '#22a98e']]); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath(); c.ellipse(-44, -108, 14, 24, 0.5, 0, K.TAU); c.fill();
  c.beginPath(); c.arc(-24, -128, 6, 0, K.TAU); c.fill();
  eyes(c, 2, -74, 15, 26, closed);
  cheeks(c, 2, -50, 46, 12);
  c.lineWidth = 5; c.strokeStyle = '#1b1530'; c.lineCap = 'round';
  c.beginPath(); c.arc(2, -52, 9, 0.2, Math.PI - 0.2); c.stroke();
}

function fox(c, closed) {
  // orange fox-like pup sitting; origin = bottom centre; tail drawn separately
  const OUT = '#6b2a10';
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(60,30,0,0.22)'; c.beginPath(); c.ellipse(0, 0, 80, 11, 0, 0, K.TAU); c.fill();
  const stroke = (lw = 8) => { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); };
  // body
  c.beginPath(); c.ellipse(0, -58, 62, 60, 0, 0, K.TAU); c.fillStyle = '#ff8a2e'; c.fill(); stroke();
  c.beginPath(); c.ellipse(0, -46, 36, 40, 0, 0, K.TAU); c.fillStyle = '#fff1d8'; c.fill();
  // paws
  for (const px of [-28, 28]) { c.beginPath(); c.ellipse(px, -8, 20, 13, 0, 0, K.TAU); c.fillStyle = '#5a2a14'; c.fill(); stroke(6); }
  // ears
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(d * 30, -170); c.lineTo(d * 78, -252); c.lineTo(d * 92, -160); c.closePath();
    c.fillStyle = '#ff8a2e'; c.fill(); stroke();
    c.beginPath(); c.moveTo(d * 46, -176); c.lineTo(d * 76, -228); c.lineTo(d * 82, -170); c.closePath(); c.fillStyle = '#ffd9b0'; c.fill();
    c.beginPath(); c.moveTo(d * 70, -232); c.lineTo(d * 78, -252); c.lineTo(d * 86, -226); c.closePath(); c.fillStyle = '#4a1d0c'; c.fill();
  }
  // head
  c.beginPath(); c.ellipse(0, -150, 84, 66, 0, 0, K.TAU); c.fillStyle = '#ff8a2e'; c.fill(); stroke();
  c.beginPath(); c.moveTo(-70, -128); c.quadraticCurveTo(0, -60, 70, -128); c.quadraticCurveTo(30, -110, 0, -118); c.quadraticCurveTo(-30, -110, -70, -128); c.fillStyle = '#fff1d8'; c.fill();
  // little leaf mark
  c.beginPath(); c.moveTo(0, -206); c.quadraticCurveTo(12, -192, 0, -178); c.quadraticCurveTo(-12, -192, 0, -206); c.fillStyle = '#ffd23f'; c.fill();
  eyes(c, 0, -152, 14, 32, closed);
  c.fillStyle = '#2a1206'; c.beginPath(); c.ellipse(0, -122, 9, 6, 0, 0, K.TAU); c.fill();
  c.lineWidth = 4; c.strokeStyle = '#2a1206';
  c.beginPath(); c.moveTo(-10, -110); c.quadraticCurveTo(0, -104, 0, -114); c.quadraticCurveTo(0, -104, 10, -110); c.stroke();
  cheeks(c, 0, -128, 52, 11);
}
function foxTail(c) {
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(0, 0); c.bezierCurveTo(60, 10, 120, -40, 110, -120);
  c.bezierCurveTo(105, -150, 70, -160, 60, -130);
  c.bezierCurveTo(80, -80, 40, -40, 0, -36); c.closePath();
  c.fillStyle = '#ff8a2e'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#6b2a10'; c.stroke();
  c.save(); c.clip();
  c.fillStyle = '#fff1d8'; c.beginPath(); c.arc(92, -136, 34, 0, K.TAU); c.fill();
  c.restore();
  c.stroke();
}

function bird(c, closed) {
  // coral cotton-ball bird with a teal tuft; origin = bottom centre (wings drawn separately)
  const OUT = '#7a2440';
  c.lineJoin = 'round';
  c.fillStyle = 'rgba(80,0,30,0.2)'; c.beginPath(); c.ellipse(0, 0, 64, 10, 0, 0, K.TAU); c.fill();
  // feet
  c.strokeStyle = '#e8892b'; c.lineWidth = 7; c.lineCap = 'round';
  for (const fx of [-20, 20]) { c.beginPath(); c.moveTo(fx, -20); c.lineTo(fx, -2); c.moveTo(fx - 10, -2); c.lineTo(fx + 10, -2); c.stroke(); }
  // tuft
  for (const [a, l] of [[-0.5, 46], [0, 58], [0.5, 44]]) {
    c.save(); c.translate(0, -168); c.rotate(a);
    c.beginPath(); c.ellipse(0, -l / 2, 11, l / 2, 0, 0, K.TAU); c.fillStyle = '#2ec4b6'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#13685f'; c.stroke();
    c.restore();
  }
  // fluffy body: scalloped circle
  const body = () => {
    c.beginPath();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * K.TAU, r = 88 + (i % 2 ? 6 : 0);
      const x = Math.cos(a) * r, y = -96 + Math.sin(a) * r * 0.92;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
  };
  body(); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke();
  body(); c.fillStyle = K.radGrad(c, -26, -130, 10, 110, [[0, '#ffd0da'], [0.6, '#ff8fa6'], [1, '#f2647f']]); c.fill();
  c.beginPath(); c.ellipse(0, -66, 50, 44, 0, 0, K.TAU); c.fillStyle = '#fff1e6'; c.fill();
  eyes(c, 0, -116, 14, 30, closed);
  // beak
  c.beginPath(); c.moveTo(-13, -98); c.lineTo(13, -98); c.lineTo(0, -80); c.closePath(); c.fillStyle = '#ffb02e'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#b2581a'; c.stroke();
  cheeks(c, 0, -96, 50, 10);
}
function wing(c) {
  c.beginPath(); c.ellipse(0, 0, 22, 38, 0.3, 0, K.TAU);
  c.fillStyle = '#ff7f99'; c.fill(); c.lineWidth = 7; c.strokeStyle = '#7a2440'; c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 400, (c, text) => {
    const outl = [[40, DEEP], [18, '#ffffff']];
    text('CRITTER', 620, 196, {
      font: K.font(400, 200, 'Titan One'), tracking: 0.02,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#d4ff7a'], [0.5, '#6edb47'], [1, '#22a23c']]),
      outlines: outl, extrude: { dx: 0, dy: 16, steps: 16, color: DEEP },
      highlight: { color: 'rgba(255,255,255,0.45)', height: 0.36 },
    });
    text('QUEST', 640, 352, {
      font: K.font(400, 168, 'Titan One'), tracking: 0.04,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff7a8'], [0.5, '#ffd12e'], [1, '#ff9f1a']]),
      outlines: outl, extrude: { dx: 0, dy: 14, steps: 14, color: DEEP },
      highlight: { color: 'rgba(255,255,255,0.5)', height: 0.36 },
    });
    // sparkles
    for (const [x, y, r] of [[96, 70, 26], [1150, 250, 22], [380, 300, 16]]) {
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * K.TAU - Math.PI / 2, rr = i % 2 ? r * 0.32 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.closePath(); c.fillStyle = '#fff6a0'; c.fill(); c.lineWidth = 5; c.strokeStyle = DEEP; c.stroke();
    }
  });
  const spr = (draw, closed) => M.sprite(240, 280, s, (c) => { c.translate(120, 266); draw(c, closed); });
  const blobS = [spr(blob, false), spr(blob, true)];
  const foxS = [spr(fox, false), spr(fox, true)];
  const birdS = [spr(bird, false), spr(bird, true)];
  const tail = M.sprite(160, 180, s, (c) => { c.translate(20, 170); foxTail(c); });
  const wingS = M.sprite(70, 100, s, (c) => { c.translate(35, 50); wing(c); });
  const cloudA = M.cloud(s, 320, 130, [[60, 88, 44], [130, 64, 58], [200, 78, 48], [262, 94, 32], [160, 100, 32]], '#ffffff', '#d9ecff');
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Titan One', px: 34, fill: '#ffffff', tracking: 0.08, padX: 36, padY: 12,
    plate: (x, pw, ph) => { K.roundRect(x, 3, 3, pw - 6, ph - 6, ph / 2); x.fillStyle = '#21963c'; x.fill(); x.lineWidth = 5; x.strokeStyle = DEEP; x.stroke(); },
  });
  const blink = (t, ph) => (t + ph) % 3.1 < 0.12;
  const bits = M.field(16, 61);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 470, [[0, '#2aa7f5'], [0.6, '#6fd0ff'], [1, '#b9f0ff']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.radGrad(ctx, 110, 60, 0, 380, [[0, 'rgba(255,252,220,0.95)'], [0.18, 'rgba(255,248,200,0.55)'], [1, 'rgba(255,248,200,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      // distant mountains + forest
      K.ridge(ctx, 1280, 720, 400, 110, '#8ccbe8', 21, { step: 60, jag: 0.6 });
      M.wavePath(ctx, 0, 1280, 440, [[10, 0.03, 1], [6, 0.07, 2]], 6);
      ctx.fillStyle = '#3f9e58'; ctx.fill();
      // meadow hills
      M.wavePath(ctx, 0, 1280, 470, [[20, 0.005, 2.5], [8, 0.016, 1]]);
      ctx.fillStyle = K.linGrad(ctx, 0, 440, 0, 720, [[0, '#8ee35a'], [1, '#5cc23f']]); ctx.fill();
      M.wavePath(ctx, 0, 1280, 560, [[18, 0.004, 0.2], [7, 0.013, 2.2]]);
      ctx.fillStyle = K.linGrad(ctx, 0, 530, 0, 720, [[0, '#6fd24a'], [1, '#43a836']]); ctx.fill();
      // flowers
      const r = K.rng(5);
      for (let i = 0; i < 160; i++) {
        const x = r() * 1280, y = 480 + Math.pow(r(), 0.7) * 240, sz = 2 + (y - 470) * 0.022;
        ctx.fillStyle = ['#ffffff', '#ffe14a', '#ff8fb6', '#ffffff'][i % 4];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * K.TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * sz, y + Math.sin(a) * sz, sz * 0.8, 0, K.TAU); ctx.fill(); }
        ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x, y, sz * 0.7, 0, K.TAU); ctx.fill();
      }
      // grass tufts in front
      ctx.fillStyle = '#3a9a33';
      for (let i = 0; i < 40; i++) {
        const x = r() * 1280, y = 690 + r() * 40, hh = 20 + r() * 30;
        M.poly(ctx, [x - 10, y, x - 3, y - hh, x + 2, y - 4, x + 8, y - hh * 0.8, x + 12, y]); ctx.fill();
      }
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.03, vignette: 0.25, vColor: '0,40,60' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      M.put(ctx, cloudA, M.wrap(300 + t * 12, -200, 1480), 92);
      M.put(ctx, cloudA, M.wrap(1000 + t * 8, -200, 1480), 150);
      // floating seeds
      for (const b of bits) {
        const x = M.wrap(b.a * 1280 + t * (18 + b.b * 16), 0, 1280), y = 420 + b.c * 220 + Math.sin(t * 1.4 + b.d * 6) * 16;
        ctx.fillStyle = 'rgba(255,255,240,0.85)'; ctx.fillRect(x, y, 5, 5);
      }
      // critters (each pops in, then idles)
      const pop = (t0) => K.easeOutBack((t - t0) / 0.3, 2.2);
      // fox: tail wag + bob
      {
        const p = pop(0.28); if (p > 0) {
          ctx.save(); ctx.translate(1040, 668); ctx.scale(p, p);
          ctx.save(); ctx.translate(46, -40); ctx.rotate(Math.sin(t * 5) * 0.16); ctx.drawImage(tail, -20, -170, 160, 180); ctx.restore();
          ctx.translate(0, Math.sin(t * 2.2) * 2.5);
          ctx.drawImage(foxS[blink(t, 0.7) ? 1 : 0], -120, -266, 240, 280);
          ctx.restore();
        }
      }
      // blob: squash and stretch
      {
        const p = pop(0.2); if (p > 0) {
          const sq = Math.sin(t * 3.4);
          ctx.save(); ctx.translate(250, 672); ctx.scale(p * (1 + 0.05 * sq), p * (1 - 0.05 * sq));
          ctx.drawImage(blobS[blink(t, 1.9) ? 1 : 0], -120, -266, 240, 280);
          ctx.restore();
        }
      }
      // bird: hop + flap
      {
        const p = pop(0.36); if (p > 0) {
          const hop = Math.max(0, Math.sin(t * 4.2)) * 16;
          ctx.save(); ctx.translate(660, 690 - hop); ctx.scale(p * 0.9, p * 0.9);
          for (const d of [-1, 1]) {
            ctx.save(); ctx.translate(d * 84, -100); ctx.rotate(d * (0.5 + Math.sin(t * 14) * 0.35)); ctx.scale(d, 1);
            ctx.drawImage(wingS, -35, -50, 70, 100); ctx.restore();
          }
          ctx.drawImage(birdS[blink(t, 0.2) ? 1 : 0], -120, -266, 240, 280);
          ctx.restore();
        }
      }
      // logo drops in with a bounce
      const st = M.intro(t, 'drop', { t0: 0.0, dur: 0.36, dist: 420 });
      M.drawLogo(ctx, L, 640, 214, st, t, { bob: [4, 0.5], shine: M.sweep(t, 0.75, 0.45, 4.4), shineOpts: { alpha: 0.65 } });
      M.drawPrompt(ctx, prompt, 640, 440, t, { t0: 0.6, hz: 1.4 });
      ctx.restore();
    },
  };
}
