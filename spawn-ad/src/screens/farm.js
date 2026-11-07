// MOONBERRY FARM: cozy farming. Pastel morning, rolling hills, crop rows, a little barn; cream + berry logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'farm', title: 'MOONBERRY FARM', word: 'cozy farming', aspect: 16 / 9 };

const PLUM = '#4a1236', BERRY = '#c92d6b', CREAM = '#fff7e6';

function berry(c, x, y, r) {
  c.fillStyle = K.radGrad(c, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.1, [[0, '#9f86ff'], [0.55, '#5b3fb8'], [1, '#2c1a6a']]);
  c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.fill();
  c.lineWidth = r * 0.22; c.strokeStyle = PLUM; c.stroke();
  // tiny crescent shine
  c.fillStyle = 'rgba(255,250,235,0.9)';
  c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, K.TAU); c.fill();
  c.fillStyle = '#5b3fb8';
  c.beginPath(); c.arc(x - r * 0.18, y - r * 0.38, r * 0.28, 0, K.TAU); c.fill();
}
function leaf(c, x, y, len, ang, fill) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  c.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 5; c.strokeStyle = PLUM; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(len * 0.12, 0); c.lineTo(len * 0.8, 0); c.stroke();
  c.restore();
}

export function create(w, h) {
  const s = w / 1280;

  const L = M.makeLogo(s, 1260, 380, (c, text) => {
    // ribbon banner for FARM
    const bx = 630, by = 282;
    c.lineJoin = 'round';
    const tail = (dir) => {
      const x0 = bx + dir * 250;
      M.poly(c, [x0, by - 34, x0 + dir * 120, by - 30, x0 + dir * 88, by + 12, x0 + dir * 122, by + 56, x0, by + 52]);
      c.fillStyle = '#93204f'; c.fill(); c.lineWidth = 9; c.strokeStyle = PLUM; c.stroke();
    };
    tail(-1); tail(1);
    c.beginPath();
    c.moveTo(bx - 275, by - 62); c.quadraticCurveTo(bx, by - 84, bx + 275, by - 62);
    c.lineTo(bx + 275, by + 54); c.quadraticCurveTo(bx, by + 32, bx - 275, by + 54); c.closePath();
    c.fillStyle = K.linGrad(c, 0, by - 70, 0, by + 54, [[0, '#f0558d'], [1, '#b8245c']]);
    c.fill(); c.lineWidth = 10; c.strokeStyle = PLUM; c.stroke();
    c.strokeStyle = 'rgba(255,220,235,0.55)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(bx - 255, by - 48); c.quadraticCurveTo(bx, by - 68, bx + 255, by - 48); c.stroke();
    text('FARM', bx, by + 40, {
      font: K.font(700, 128, 'Fredoka'), fill: CREAM, tracking: 0.08,
      outlines: [[16, PLUM]], extrude: { dx: 0, dy: 7, steps: 7, color: PLUM },
    });
    // MOONBERRY
    text('MOONBERRY', 630, 196, {
      font: K.font(700, 188, 'Fredoka'),
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fffdf6'], [0.55, '#fff1d6'], [1, '#ffd2a8']]),
      outlines: [[38, PLUM], [20, BERRY]],
      extrude: { dx: 0, dy: 16, steps: 16, color: PLUM },
      highlight: { color: 'rgba(255,255,255,0.75)', height: 0.4 },
    });
    // moonberry sprig on the Y
    leaf(c, 1168, 52, 62, -0.6, '#6fcf6a');
    leaf(c, 1168, 52, 54, -2.3, '#58b957');
    berry(c, 1150, 70, 22); berry(c, 1192, 66, 19); berry(c, 1170, 98, 18);
  });

  const cloudA = M.cloud(s, 300, 120, [[60, 80, 40], [120, 60, 52], [185, 70, 44], [240, 86, 30], [150, 92, 30]], '#ffffff', '#e8eef9', null);
  const cloudB = M.cloud(s, 220, 100, [[50, 68, 32], [100, 50, 42], [155, 64, 34], [110, 76, 28]], '#fffdfa', '#eef0fa', null);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Fredoka', weight: 700, px: 34, fill: CREAM, tracking: 0.1, padX: 34, padY: 12,
    plate: (x, pw, ph) => { K.roundRect(x, 3, 3, pw - 6, ph - 6, ph / 2); x.fillStyle = 'rgba(74,18,54,0.82)'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#ff8fb6'; x.stroke(); },
  });
  const crescent = M.sprite(80, 80, s, (x) => {
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.beginPath(); x.arc(40, 40, 34, 0, K.TAU); x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(56, 30, 30, 0, K.TAU); x.fill();
  });
  const flyers = M.field(5, 31);
  const pollen = M.field(22, 32);

  const farHills = [[16, 0.0062, 1.1], [9, 0.0141, 2.3]];
  const midHills = [[24, 0.0047, 0.4], [10, 0.0113, 2.9]];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#5fb6ea'], [0.4, '#9ad3ef'], [0.6, '#f9c8ab'], [0.72, '#ffd4b2']]);
      ctx.fillRect(0, 0, 1280, 720);
      // sun in the corner with soft rays
      ctx.globalAlpha = 0.22;
      K.rays(ctx, 1170, 40, 18, 900, 'rgba(255,248,214,0.0)', 'rgba(255,246,206,1)', 0.15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = K.radGrad(ctx, 1170, 40, 0, 460, [[0, 'rgba(255,246,205,0.95)'], [0.22, 'rgba(255,230,170,0.5)'], [1, 'rgba(255,220,170,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#fff1bb';
      ctx.beginPath(); ctx.arc(1170, 40, 92, 0, K.TAU); ctx.fill();
      ctx.fillStyle = '#ffe58f';
      ctx.beginPath(); ctx.arc(1170, 40, 70, 0, K.TAU); ctx.fill();
      // pale daytime crescent moon
      M.put(ctx, crescent, 120, 70);
      // far hills
      M.wavePath(ctx, 0, 1280, 445, farHills);
      ctx.fillStyle = K.linGrad(ctx, 0, 410, 0, 560, [[0, '#bfe6a8'], [1, '#9fd58f']]); ctx.fill();
      // little trees on far hills
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 150 + (i % 2) * 40, y = M.waveY(x, 445, farHills);
        ctx.fillStyle = '#7fc277';
        ctx.beginPath(); ctx.arc(x, y - 10, 15, 0, K.TAU); ctx.arc(x + 14, y - 4, 11, 0, K.TAU); ctx.fill();
      }
      // mid hills
      M.wavePath(ctx, 0, 1280, 498, midHills);
      ctx.fillStyle = K.linGrad(ctx, 0, 460, 0, 640, [[0, '#93d47f'], [1, '#6dbf63']]); ctx.fill();
      // barn + silo on the right
      const bx = 1060, by = M.waveY(1060, 498, midHills) + 6;
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#efe0c2';
      ctx.fillRect(bx + 92, by - 150, 52, 150);
      ctx.fillStyle = '#d9c7a4'; ctx.fillRect(bx + 126, by - 150, 18, 150);
      ctx.fillStyle = '#8e9bb5'; ctx.beginPath(); ctx.arc(bx + 118, by - 150, 26, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#c9b48d'; ctx.lineWidth = 3;
      for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(bx + 92, by - 150 + k * 30); ctx.lineTo(bx + 144, by - 150 + k * 30); ctx.stroke(); }
      M.poly(ctx, [bx - 88, by, bx - 88, by - 92, bx - 66, by - 140, bx, by - 168, bx + 66, by - 140, bx + 88, by - 92, bx + 88, by]);
      ctx.fillStyle = K.linGrad(ctx, bx - 88, 0, bx + 88, 0, [[0, '#e0476a'], [1, '#b8304f']]); ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = '#fff4e2';
      M.poly(ctx, [bx - 92, by - 90, bx - 68, by - 142, bx, by - 172, bx + 68, by - 142, bx + 92, by - 90], false); ctx.stroke();
      ctx.fillStyle = '#7d2038'; ctx.fillRect(bx - 34, by - 74, 68, 74);
      ctx.strokeStyle = '#fff4e2'; ctx.lineWidth = 6; ctx.strokeRect(bx - 34, by - 74, 68, 74);
      ctx.beginPath(); ctx.moveTo(bx - 34, by - 74); ctx.lineTo(bx + 34, by); ctx.moveTo(bx + 34, by - 74); ctx.lineTo(bx - 34, by); ctx.stroke();
      ctx.fillStyle = '#7d2038'; ctx.fillRect(bx - 15, by - 130, 30, 26); ctx.strokeRect(bx - 15, by - 130, 30, 26);
      // round trees on the left of the mid hill
      for (const [tx, r] of [[110, 46], [190, 36], [262, 28]]) {
        const ty = M.waveY(tx, 498, midHills);
        ctx.fillStyle = '#8b5a3c'; ctx.fillRect(tx - 6, ty - 30, 12, 34);
        ctx.fillStyle = '#4fa85a'; ctx.beginPath(); ctx.arc(tx, ty - 30 - r * 0.7, r, 0, K.TAU); ctx.fill();
        ctx.fillStyle = '#6cc46c'; ctx.beginPath(); ctx.arc(tx - r * 0.25, ty - 30 - r * 0.9, r * 0.62, 0, K.TAU); ctx.fill();
      }
      // crop field with rows converging toward the barn
      ctx.save();
      M.wavePath(ctx, 0, 1280, 560, [[14, 0.004, 2.2], [6, 0.012, 0.3]]);
      ctx.fillStyle = '#5fb257'; ctx.fill();
      ctx.clip();
      const vx = 700, vy = 420;
      for (let i = -14; i <= 14; i++) {
        const a0 = Math.PI / 2 + i * 0.075, a1 = a0 + 0.037;
        ctx.beginPath(); ctx.moveTo(vx, vy);
        ctx.lineTo(vx + Math.cos(a0) * 1400, vy + Math.sin(a0) * 1400);
        ctx.lineTo(vx + Math.cos(a1) * 1400, vy + Math.sin(a1) * 1400);
        ctx.closePath(); ctx.fillStyle = '#4a9a48'; ctx.fill();
      }
      // berry dots along the dark rows
      const r = K.rng(9);
      for (let i = -14; i <= 14; i++) {
        const a = Math.PI / 2 + i * 0.075 + 0.0185;
        for (let d = 180; d < 900; d += 26 + d * 0.05) {
          const x = vx + Math.cos(a) * d, y = vy + Math.sin(a) * d;
          if (y < 545) continue;
          const sz = 2 + (y - 540) * 0.045;
          ctx.fillStyle = r() < 0.5 ? '#ff6f9f' : '#8f6cf0';
          ctx.beginPath(); ctx.arc(x, y, sz, 0, K.TAU); ctx.fill();
        }
      }
      ctx.restore();
      // front corner bushes
      for (const [x, y, rr] of [[40, 700, 80], [140, 730, 70], [1230, 700, 86], [1130, 735, 64]]) {
        ctx.fillStyle = '#3f8f45'; ctx.beginPath(); ctx.arc(x, y, rr, 0, K.TAU); ctx.fill();
        ctx.fillStyle = '#56ab55'; ctx.beginPath(); ctx.arc(x - rr * 0.2, y - rr * 0.25, rr * 0.7, 0, K.TAU); ctx.fill();
        for (let k = 0; k < 6; k++) berry(ctx, x - rr * 0.6 + r() * rr * 1.1, y - rr * 0.5 + r() * rr * 0.5, 9);
      }
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.035, vignette: 0.28, vColor: '60,20,60' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // drifting clouds
      M.put(ctx, cloudA, M.wrap(160 + t * 14, -200, 1480), 150);
      M.put(ctx, cloudB, M.wrap(900 + t * 9, -200, 1480), 92);
      M.put(ctx, cloudB, M.wrap(560 + t * 11, -200, 1480), 262);
      // floating pollen
      for (const p of pollen) {
        const x = M.wrap(p.a * 1280 + t * (8 + p.c * 14), 0, 1280);
        const y = 380 + p.b * 300 + Math.sin(t * (0.8 + p.d) + p.e * 6) * 14;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + p.f * 6);
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(x, y, 4, 4);
      }
      ctx.globalAlpha = 1;
      // butterflies
      flyers.forEach((b, i) => {
        const x = M.wrap(b.a * 1280 + t * (26 + b.b * 20) * (i % 2 ? 1 : -1), -40, 1320);
        const y = 470 + b.c * 180 + Math.sin(t * (1.6 + b.d) + i) * 26;
        const flap = Math.abs(Math.sin(t * 14 + i * 2));
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = i % 2 ? '#ff8fbf' : '#ffe066';
        ctx.scale(0.3 + 0.7 * flap, 1);
        ctx.beginPath(); ctx.ellipse(-8, -4, 9, 7, 0.4, 0, K.TAU); ctx.ellipse(8, -4, 9, 7, -0.4, 0, K.TAU); ctx.fill();
        ctx.restore();
      });
      // logo
      const st = M.intro(t, 'pop', { t0: 0.04, dur: 0.3 });
      M.drawLogo(ctx, L, 640, 232, st, t, { bob: [4, 0.42], shine: M.sweep(t, 0.6, 0.55, 4.5), shineOpts: { alpha: 0.7 } });
      M.drawPrompt(ctx, prompt, 640, 655, t, { t0: 0.5 });
      ctx.restore();
    },
  };
}
