// DODGE DYNASTY: dodgeball. Retro gym: striped wall, wood court with painted lines, flying balls with streaks;
// striped Russo One logo with a ball for the O.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'dodgeball', title: 'DODGE DYNASTY', word: 'dodgeball', aspect: 16 / 9 };

const NAVY = '#141640';
const VP = [640, 250];

function ball(c, r) {
  c.beginPath(); c.arc(0, 0, r, 0, K.TAU);
  c.fillStyle = K.radGrad(c, -r * 0.35, -r * 0.4, r * 0.1, r * 1.1, [[0, '#ff8a7a'], [0.45, '#ef2b2b'], [1, '#9c0f1c']]);
  c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(80,0,10,0.18)';
  const rr = K.rng(9);
  for (let i = 0; i < 60; i++) { const a = rr() * K.TAU, d = Math.sqrt(rr()) * r; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.035, 0, K.TAU); c.fill(); }
  c.strokeStyle = 'rgba(90,0,12,0.45)'; c.lineWidth = r * 0.06;
  c.beginPath(); c.ellipse(0, 0, r * 0.35, r * 1.05, 0.5, 0, K.TAU); c.stroke();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath(); c.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.13, -0.7, 0, K.TAU); c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, K.TAU); c.lineWidth = Math.max(4, r * 0.1); c.strokeStyle = NAVY; c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const stripes = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [
    [0, '#fff6d8'], [0.46, '#fff1c8'], [0.46, '#ffb21f'], [0.63, '#ffb21f'], [0.63, '#ff6a1f'], [0.8, '#ff6a1f'], [0.8, '#e8232f'], [1, '#e8232f']]);
  const L = M.makeLogo(s, 1240, 410, (c, text) => {
    const font = K.font(400, 228, 'Russo One');
    const base = { font, fill: stripes, outlines: [[38, NAVY], [14, '#ffffff']], extrude: { dx: 12, dy: 15, steps: 15, color: NAVY }, skewX: 0.2, align: 'left' };
    c.font = font;
    const wD = c.measureText('D').width, wO = c.measureText('O').width, wR = c.measureText('DGE').width;
    const x0 = 620 - (wD + wO + wR) / 2, by = 214;
    const cap = 160, bx = x0 + wD + wO / 2 + 0.2 * cap / 2, byc = by - cap / 2;
    // motion streaks behind the letters
    c.save(); c.translate(bx, byc); c.lineCap = 'round';
    for (const [dy, len, lw] of [[-46, 300, 12], [0, 380, 14], [46, 290, 12]]) { c.lineWidth = lw + 12; c.strokeStyle = NAVY; c.beginPath(); c.moveTo(-60, dy); c.lineTo(-60 - len, dy); c.stroke(); c.lineWidth = lw; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(-60, dy); c.lineTo(-60 - len, dy); c.stroke(); }
    c.restore();
    text('D', x0, by, base);
    text('DGE', x0 + wD + wO, by, base);
    // the ball as the O
    c.save(); c.translate(bx, byc);
    c.fillStyle = NAVY; c.beginPath(); c.arc(9, 12, 92, 0, K.TAU); c.fill();
    ball(c, 86);
    c.restore();
    // DYNASTY on a slanted jersey bar
    c.lineJoin = 'round';
    M.poly(c, [282, 262, 1000, 262, 960, 384, 242, 384]);
    c.fillStyle = NAVY; c.save(); c.translate(10, 12); c.fill(); c.restore();
    c.fillStyle = K.linGrad(c, 0, 262, 0, 384, [[0, '#2fe0d6'], [1, '#12a6b4']]); c.fill();
    c.lineWidth = 9; c.strokeStyle = NAVY; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; M.poly(c, [288, 270, 994, 270, 991, 280, 285, 280]); c.fill();
    text('DYNASTY', 622, 364, { font: K.font(400, 124, 'Russo One'), fill: '#ffffff', tracking: 0.12, skewX: 0.2, outlines: [[16, NAVY]] });
  });
  const ballS = M.sprite(220, 220, s, (c) => { c.translate(110, 110); ball(c, 100); });
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Russo One', weight: 'italic 400', px: 32, fill: '#ffffff', tracking: 0.14, padX: 40, padY: 12,
    plate: (x, pw, ph) => { M.poly(x, [16, 4, pw - 4, 4, pw - 16, ph - 4, 4, ph - 4]); x.fillStyle = NAVY; x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffb21f'; x.stroke(); },
  });
  // balls: [x, y, radius, dirX, dirY, phase]
  const BALLS = [[1110, 520, 62, -1, 0.12, 0], [1170, 150, 34, -1, 0.3, 1.7], [140, 600, 104, 1, -0.32, 0.8], [90, 140, 26, 1, 0.2, 2.6]];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      // back wall
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 440, [[0, '#0f1438'], [1, '#1d2c6a']]);
      ctx.fillRect(0, 0, 1280, 440);
      // ceiling lights
      for (let x = 60; x < 1280; x += 200) {
        ctx.fillStyle = 'rgba(255,250,220,0.18)'; M.poly(ctx, [x - 20, 18, x + 100, 18, x + 170, 140, x - 90, 140]); ctx.fill();
        ctx.fillStyle = '#fff8dc'; ctx.fillRect(x - 10, 10, 100, 10);
      }
      // pennants
      ctx.strokeStyle = '#c9cde0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 46); ctx.quadraticCurveTo(640, 96, 1280, 46); ctx.stroke();
      const PC = ['#ff3b30', '#ffb21f', '#2fe0d6', '#ffffff'];
      for (let i = 0; i < 22; i++) {
        const x = 20 + i * 60, u = x / 1280, y = 46 + 4 * 50 * u * (1 - u);
        ctx.fillStyle = PC[i % 4]; M.poly(ctx, [x - 18, y, x + 18, y, x, y + 38]); ctx.fill();
      }
      // retro stripes
      for (const [y, hh, col] of [[262, 22, '#ffb21f'], [292, 22, '#ff6a1f'], [322, 22, '#e8232f']]) { ctx.fillStyle = col; ctx.fillRect(0, y, 1280, hh); }
      // wall mats
      ctx.fillStyle = '#2a5fc4'; ctx.fillRect(0, 360, 1280, 80);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < 1280; x += 128) ctx.fillRect(x, 360, 4, 80);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 362, 1280, 4);
      // wood floor
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 440, 1280, 280); ctx.clip();
      ctx.fillStyle = K.linGrad(ctx, 0, 440, 0, 720, [[0, '#c9783a'], [1, '#e39a52']]);
      ctx.fillRect(0, 440, 1280, 280);
      ctx.strokeStyle = 'rgba(90,40,10,0.35)'; ctx.lineWidth = 2;
      for (let i = -40; i <= 40; i++) { ctx.beginPath(); ctx.moveTo(VP[0] + i * 12, 440); ctx.lineTo(VP[0] + i * 70, 720); ctx.stroke(); }
      const r = K.rng(4);
      for (let y = 450; y < 720; y += 14 + (y - 440) * 0.08) {
        for (let i = -40; i <= 40; i += 3) {
          if (r() < 0.4) continue;
          const u = (y - 440) / 280, x = VP[0] + (i + r() * 3) * (12 + 58 * u);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + 40 * u, y); ctx.stroke();
        }
      }
      // light reflections
      for (let x = 100; x < 1280; x += 200) {
        ctx.fillStyle = K.linGrad(ctx, 0, 440, 0, 640, [[0, 'rgba(255,240,210,0.35)'], [1, 'rgba(255,240,210,0)']]);
        ctx.beginPath(); ctx.ellipse(x, 520, 30, 90, 0, 0, K.TAU); ctx.fill();
      }
      // court lines
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(0, 600); ctx.lineTo(1280, 600); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(640, 600, 210, 52, 0, 0, K.TAU); ctx.stroke();
      ctx.strokeStyle = '#2a5fc4'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(150, 720); ctx.lineTo(330, 452); ctx.moveTo(1130, 720); ctx.lineTo(950, 452); ctx.stroke();
      ctx.fillStyle = 'rgba(47,224,214,0.55)'; ctx.beginPath(); ctx.ellipse(640, 600, 60, 15, 0, 0, K.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 438, 1280, 4);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.04, vignette: 0.4, vColor: '10,10,40' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // balls frozen mid-flight, drifting, spinning, with streaks
      BALLS.forEach(([x0, y0, r, dx, dy, ph], i) => {
        const d = Math.sin(t * 1.3 + ph) * 18;
        const x = x0 + dx * d, y = y0 + dy * d;
        const len = r * 3.2, nx = -dx, ny = -dy, n = Math.hypot(nx, ny);
        ctx.lineCap = 'round';
        for (let j = -1; j <= 1; j++) {
          const ox = (-ny / n) * j * r * 0.55, oy = (nx / n) * j * r * 0.55;
          const flick = 0.75 + 0.25 * Math.sin(t * 17 + j + i);
          const L2 = len * (j === 0 ? 1 : 0.7) * flick;
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = r * 0.16;
          ctx.beginPath(); ctx.moveTo(x + ox + (nx / n) * r * 1.1, y + oy + (ny / n) * r * 1.1);
          ctx.lineTo(x + ox + (nx / n) * (r + L2), y + oy + (ny / n) * (r + L2)); ctx.stroke();
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 * dx + ph);
        ctx.drawImage(ballS, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
        ctx.restore();
      });
      const st = M.intro(t, 'slide', { t0: 0.03, dur: 0.3, dir: 1, dist: 1500, skew: 0.5 });
      const [sx, sy] = M.shake(t, 0.33, 0.22, 9, 5);
      M.drawLogo(ctx, L, 640 + sx, 238 + sy, st, t, { bob: [3, 0.6], shine: M.sweep(t, 0.6, 0.45, 4) });
      M.drawPrompt(ctx, prompt, 640, 672, t, { t0: 0.5, hz: 1.5 });
      ctx.restore();
    },
  };
}
