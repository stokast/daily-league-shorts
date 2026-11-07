// STEEL TITANS: mech. A giant robot silhouette against an industrial sunset haze, smokestacks, sparks;
// chrome Orbitron 900 logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'mech', title: 'STEEL TITANS', word: 'mech', aspect: 16 / 9 };

const MX = 640, MY = 812, MK = 1.3; // mech feet + scale
const RIM = '#ff8a3d';

function mechShape(c) {
  // front view, origin = between the feet
  const P = (pts) => M.poly(c, pts);
  const parts = [];
  for (const d of [-1, 1]) {
    parts.push([d * 40, -310, d * 124, -300, d * 132, -190, d * 58, -180]);           // thigh
    parts.push([d * 128, -184, d * 58, -172, d * 52, -40, d * 138, -40]);             // shin
    parts.push([d * 168, 0, d * 34, 0, d * 46, -44, d * 150, -44]);                   // foot
    parts.push([d * 150, -470, d * 300, -456, d * 300, -560, d * 168, -584]);         // pauldron
    parts.push([d * 118, -590, d * 148, -590, d * 150, -660, d * 120, -660]);         // exhaust stack
  }
  parts.push([-112, -334, 112, -334, 84, -282, -84, -282]);                          // pelvis
  parts.push([-168, -530, 168, -530, 146, -404, 92, -330, -92, -330, -146, -404]);    // chest
  parts.push([-50, -606, 50, -606, 60, -540, -60, -540]);                             // head
  parts.push([-70, -546, 70, -546, 52, -520, -52, -520]);                             // collar
  // left arm hanging, right arm holding a cannon
  parts.push([-286, -470, -214, -470, -218, -360, -282, -360]);
  parts.push([-300, -366, -204, -366, -210, -236, -296, -246]);
  parts.push([-292, -246, -214, -238, -222, -196, -286, -200]);
  parts.push([214, -470, 286, -470, 282, -360, 218, -360]);
  parts.push([204, -366, 300, -366, 300, -270, 210, -270]);
  parts.push([236, -300, 420, -232, 410, -204, 228, -262]);                          // cannon barrel
  parts.push([380, -244, 452, -218, 440, -186, 372, -206]);                          // muzzle
  parts.push([-4, -606, 4, -606, 4, -680, -4, -680]);                                // antenna
  for (const p of parts) { P(p); c.fill(); c.stroke(); }
  for (const d of [-1, 1]) { c.beginPath(); c.arc(d * 96, -182, 36, 0, K.TAU); c.fill(); c.stroke(); }
}

export function create(w, h) {
  const s = w / 1280;
  const chrome = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [
    [0, '#f6f9ff'], [0.25, '#c6d1e3'], [0.47, '#73839c'], [0.5, '#1f2533'], [0.55, '#3d4859'], [0.78, '#b0bfd4'], [1, '#f0f5ff']]);
  const L = M.makeLogo(s, 1240, 420, (c, text) => {
    const base = { font: K.font(900, 196, 'Orbitron'), tracking: 0.04, fill: chrome, outlines: [[30, '#06070b'], [10, '#ff7a2f']], extrude: { dx: 0, dy: 14, steps: 14, color: '#0b0d13' }, highlight: { color: 'rgba(255,255,255,0.35)', height: 0.22 } };
    text('STEEL', 620, 190, base);
    text('TITANS', 620, 382, base);
    // hazard bars between the lines
    c.save();
    c.beginPath(); c.rect(250, 210, 740, 26); c.clip();
    c.fillStyle = '#ffb02e'; c.fillRect(250, 210, 740, 26);
    c.fillStyle = '#111';
    for (let x = 230; x < 1000; x += 40) M.poly(c, [x, 236, x + 20, 236, x + 46, 210, x + 26, 210]), c.fill();
    c.restore();
    c.lineWidth = 6; c.strokeStyle = '#06070b'; c.strokeRect(250, 210, 740, 26);
  });
  const drawMech = (c) => {
    c.lineJoin = 'round';
    c.fillStyle = '#100e16'; c.strokeStyle = RIM; c.lineWidth = 7;
    mechShape(c);
    c.lineWidth = 0.01; c.strokeStyle = 'rgba(0,0,0,0)';
    c.fillStyle = '#100e16'; mechShape(c);
    // panel lines
    c.strokeStyle = 'rgba(255,140,70,0.25)'; c.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[-120, -470, 120, -470], [-90, -420, 90, -420], [0, -530, 0, -340], [-150, -520, -250, -480], [150, -520, 250, -480]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  };
  const eye = M.glow(s, 70, [[0, 'rgba(160,250,255,1)'], [0.25, 'rgba(40,220,255,0.7)'], [1, 'rgba(0,160,255,0)']]);
  const core = M.glow(s, 80, [[0, 'rgba(255,240,200,1)'], [0.3, 'rgba(255,140,40,0.7)'], [1, 'rgba(255,90,0,0)']]);
  const smoke = M.glow(s, 120, [[0, 'rgba(70,60,80,0.55)'], [1, 'rgba(70,60,80,0)']]);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Orbitron', weight: 600, px: 28, fill: '#ffb36b', tracking: 0.3, padX: 44, padY: 12,
    plate: (x, pw, ph) => {
      x.strokeStyle = '#ffb36b'; x.lineWidth = 4;
      for (const [cx, dx] of [[6, 1], [pw - 6, -1]]) { x.beginPath(); x.moveTo(cx + dx * 16, 6); x.lineTo(cx, 6); x.lineTo(cx, ph - 6); x.lineTo(cx + dx * 16, ph - 6); x.stroke(); }
    },
  });
  const sparks = M.field(36, 81);
  const puffs = M.field(10, 82);
  const STACKS = [[110, 300, 46], [210, 360, 36], [1080, 330, 40], [1190, 280, 50]];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#1e1a2c'], [0.35, '#4a2b3e'], [0.62, '#b4513a'], [0.8, '#ff9a4a'], [1, '#5a2a2a']]);
      ctx.fillRect(0, 0, 1280, 720);
      // the low sun behind the mech
      ctx.fillStyle = K.radGrad(ctx, 640, 420, 0, 560, [[0, 'rgba(255,200,120,0.75)'], [0.3, 'rgba(255,140,70,0.35)'], [1, 'rgba(255,100,60,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.linGrad(ctx, 0, 250, 0, 590, [[0, '#ffd08a'], [1, '#ff6a3a']]);
      ctx.beginPath(); ctx.arc(640, 420, 190, 0, K.TAU); ctx.fill();
      // haze bands
      for (const [y, hh, a] of [[300, 14, 0.35], [350, 10, 0.3], [430, 18, 0.35], [500, 26, 0.4], [560, 40, 0.45]]) {
        ctx.fillStyle = `rgba(90,40,60,${a})`; ctx.fillRect(0, y, 1280, hh);
      }
      // industrial skyline: factory roofs, stacks, a crane
      ctx.fillStyle = '#2a1c26';
      K.skyline(ctx, 1280, 720, 720, { seed: 5, minH: 60, maxH: 170, minW: 70, maxW: 140, fill: '#3a2430' });
      for (const [x, top, ww] of STACKS) { ctx.fillStyle = '#1e141c'; M.poly(ctx, [x - ww / 2, 720, x + ww / 2, 720, x + ww * 0.36, top, x - ww * 0.36, top]); ctx.fill(); ctx.fillStyle = '#ff7a3a'; ctx.fillRect(x - ww * 0.36, top + 30, ww * 0.72, 6); }
      ctx.strokeStyle = '#1e141c'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(330, 720); ctx.lineTo(330, 300); ctx.lineTo(560, 300); ctx.moveTo(300, 300); ctx.lineTo(330, 300); ctx.stroke();
      ctx.lineWidth = 2;
      for (let x = 330; x < 560; x += 20) { ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x + 10, 312); ctx.lineTo(x + 20, 300); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(520, 300); ctx.lineTo(520, 380); ctx.stroke();
      // saw-tooth factory front
      ctx.fillStyle = '#160f15';
      ctx.beginPath(); ctx.moveTo(0, 720);
      for (let x = 0; x <= 1280; x += 80) { ctx.lineTo(x, 640); ctx.lineTo(x + 60, 610); ctx.lineTo(x + 60, 640); }
      ctx.lineTo(1280, 720); ctx.closePath(); ctx.fill();
      // the titan (static: its lights, sparks and the smoke around it animate in fg)
      ctx.save(); ctx.translate(MX, MY); ctx.scale(MK, MK); drawMech(ctx); ctx.restore();
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.06, vignette: 0.55, vColor: '20,5,10' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // drifting smoke from the stacks
      for (const p of puffs) {
        const st = STACKS[(p.a * STACKS.length) | 0];
        const life = M.wrap(t * 0.12 + p.b, 0, 1);
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.8;
        const sc = 0.5 + life * 1.2;
        ctx.drawImage(smoke, st[0] - 120 * sc + life * 120, st[1] - 20 - life * 160 - 120 * sc, 240 * sc, 240 * sc);
      }
      ctx.globalAlpha = 1;
      // the titan's visor + core lights
      ctx.save();
      ctx.translate(MX, MY);
      ctx.scale(MK, MK);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2.6);
      M.put(ctx, eye, 0, -574);
      M.put(ctx, core, 0, -440);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c8fbff'; ctx.fillRect(-36, -580, 72, 9);
      ctx.restore();
      // welding sparks off the cannon arm
      ctx.lineCap = 'round';
      const ox = MX + 330 * MK, oy = MY - 300 * MK;
      for (const p of sparks) {
        const life = M.wrap(t * (0.9 + p.a * 0.6) + p.b, 0, 1);
        const vx = (p.c - 0.35) * 420, vy = -120 - p.d * 260;
        const tt = life * 1.1;
        const x = ox + vx * tt, y = oy + vy * tt + 0.5 * 900 * tt * tt;
        const dvx = vx, dvy = vy + 900 * tt, n = Math.hypot(dvx, dvy) || 1;
        ctx.globalAlpha = 1 - life;
        ctx.strokeStyle = p.e < 0.5 ? '#fff6c8' : '#ffb347'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (dvx / n) * 16, y - (dvy / n) * 16); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const st = M.intro(t, 'slam', { t0: 0.03, dur: 0.25, from: 1.7 });
      const [sx, sy] = M.shake(t, 0.3, 0.3, 14, 9);
      M.drawLogo(ctx, L, 640 + sx, 372 + sy, st, t, { breathe: [0.006, 0.5], shine: M.sweep(t, 0.6, 0.5, 4.2), shineOpts: { alpha: 0.9 } });
      M.drawPrompt(ctx, prompt, 640, 668, t, { t0: 0.55, hz: 1.3 });
      ctx.restore();
    },
  };
}
