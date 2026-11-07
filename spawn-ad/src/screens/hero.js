// CAPE CITY: superhero. Night skyline, sweeping searchlights, a caped silhouette on a rooftop;
// comic Bangers logo with a red 3D side and halftone dots (no real hero's emblem).
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'hero', title: 'CAPE CITY', word: 'superhero', aspect: 16 / 9 };

const INK = '#07050f';
const HX = 948, HY = 640; // hero's feet

function heroBody(c) {
  // standing heroic pose, fists on hips; origin at feet centre
  c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (lw, x0, y0, x1, y1) => { c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  line(30, -18, -110, -40, -4); line(30, 18, -110, 40, -4);           // legs
  c.beginPath(); c.ellipse(-44, -4, 22, 9, 0, 0, K.TAU); c.ellipse(44, -4, 22, 9, 0, 0, K.TAU); c.fill(); // boots
  M.poly(c, [-48, -200, 48, -200, 30, -118, -30, -118]); c.fill();     // torso
  K.roundRect(c, -34, -128, 68, 22, 6); c.fill();                      // belt/hips
  line(20, -46, -192, -78, -150); line(18, -78, -150, -36, -124);      // arms to hips
  line(20, 46, -192, 78, -150); line(18, 78, -150, 36, -124);
  c.beginPath(); c.arc(0, -228, 23, 0, K.TAU); c.fill();               // head
  M.poly(c, [-10, -210, 10, -210, 12, -198, -12, -198]); c.fill();
  // swept hair (keeps the silhouette generic: no cowl, no ears, no emblem)
  c.beginPath(); c.moveTo(-22, -238); c.quadraticCurveTo(-16, -266, 14, -258); c.quadraticCurveTo(30, -254, 34, -238); c.quadraticCurveTo(14, -250, -22, -238); c.fill();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 420, (c, text, fx) => {
    // comic burst behind
    c.save(); c.translate(620, 214); c.scale(2.15, 1);
    M.burstPath(c, 0, 0, 150, 200, 16, 11, 0.12);
    c.restore();
    c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
    c.fillStyle = K.radGrad(c, 620, 214, 20, 420, [[0, '#7fd6ff'], [0.5, '#2f86ff'], [1, '#1d4fd6']]); c.fill();
    // halftone in the burst
    c.save(); c.clip();
    c.fillStyle = 'rgba(10,30,120,0.28)';
    c.beginPath();
    for (let y = 0; y < 420; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < 1240; x += 14) {
      const d = Math.hypot((x - 620) / 2.1, y - 214) / 200;
      const r = Math.max(0, d - 0.35) * 7;
      if (r > 0.4) { c.moveTo(x + r, y); c.arc(x, y, r, 0, K.TAU); }
    }
    c.fill();
    c.restore();
    const font = K.font(400, 272, 'Bangers');
    // black under-block, then the red 3D side, then the face
    K.logoText(c, 'CAPE CITY', 620, 312, { font, tracking: 0.04, fill: INK, outlines: [[50, INK]], extrude: { dx: 18, dy: 22, steps: 22, color: INK } });
    text('CAPE CITY', 620, 312, {
      font, tracking: 0.04,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff9a8'], [0.45, '#ffe02e'], [1, '#ff9a1a']]),
      outlines: [[30, INK]], extrude: { dx: 14, dy: 18, steps: 18, color: '#e8262b' },
      highlight: { color: 'rgba(255,255,255,0.55)', height: 0.3 },
    });
    // halftone shading on the letter faces (masked by the face layer)
    const tmp = K.makeCanvas(1240 * s, 420 * s), tc = tmp.getContext('2d');
    tc.drawImage(fx.canvas, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.scale(s, s);
    tc.fillStyle = 'rgba(214,72,10,0.55)';
    tc.beginPath();
    for (let y = 150; y < 330; y += 11) for (let x = (y / 11) % 2 ? 5.5 : 0; x < 1240; x += 11) {
      const r = K.clamp((y - 200) / 120) * 4.6;
      if (r > 0.3) { tc.moveTo(x + r, y); tc.arc(x, y, r, 0, K.TAU); }
    }
    tc.fill();
    c.drawImage(tmp, 0, 0, 1240, 420);
  });
  const body = M.sprite(240, 300, s, (c) => {
    c.translate(120, 290);
    c.fillStyle = '#35e0ff'; c.strokeStyle = '#35e0ff';
    c.save(); c.translate(-4, 0); heroBody(c); c.restore();
    c.fillStyle = INK; c.strokeStyle = INK; heroBody(c);
  });
  const beam = M.sprite(220, 760, s, (c) => {
    M.poly(c, [102, 760, 118, 760, 220, 0, 0, 0]);
    c.fillStyle = K.linGrad(c, 0, 760, 0, 0, [[0, 'rgba(210,235,255,0.6)'], [0.6, 'rgba(160,200,255,0.18)'], [1, 'rgba(160,200,255,0)']]);
    c.fill();
  });
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Bangers', px: 40, fill: INK, tracking: 0.1, padX: 26, padY: 10,
    plate: (x, pw, ph) => { x.fillStyle = INK; x.fillRect(8, 8, pw - 8, ph - 8); x.fillStyle = '#ffe14a'; x.fillRect(2, 2, pw - 10, ph - 10); x.lineWidth = 4; x.strokeStyle = INK; x.strokeRect(2, 2, pw - 10, ph - 10); },
  });
  const BEAMS = [[180, 700, -0.5, 0.0], [520, 720, 0.25, 1.9], [1150, 700, 0.55, 3.3]];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#070a26'], [0.45, '#22195a'], [0.75, '#6a2a72'], [1, '#d0507a']]);
      ctx.fillRect(0, 0, 1280, 720);
      K.stars(ctx, 1280, 720, { n: 90, seed: 8, yMax: 360, maxR: 1.8 });
      // halftone dots in the upper corners
      ctx.fillStyle = 'rgba(140,110,255,0.32)';
      ctx.beginPath();
      for (let y = 0; y < 420; y += 18) for (let x = (y / 18) % 2 ? 9 : 0; x < 1280; x += 18) {
        const d = Math.min(Math.hypot(x, y), Math.hypot(1280 - x, y)) / 520;
        const r = (1 - d) * 6.5;
        if (r > 0.4) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, K.TAU); }
      }
      ctx.fill();
      // city glow
      ctx.fillStyle = K.radGrad(ctx, 640, 760, 50, 700, [[0, 'rgba(255,150,90,0.55)'], [1, 'rgba(255,90,120,0)']]);
      ctx.fillRect(0, 200, 1280, 520);
      // skyline layers
      K.skyline(ctx, 1280, 720, 720, { seed: 31, minH: 160, maxH: 430, minW: 50, maxW: 110, fill: '#3a2c7a', windows: 'rgba(170,150,255,0.5)' });
      ctx.fillStyle = '#3a2c7a';
      M.poly(ctx, [300, 720, 300, 330, 316, 300, 332, 330, 332, 720]); ctx.fill();
      ctx.fillRect(314, 230, 4, 80);
      K.skyline(ctx, 1280, 720, 720, { seed: 32, minH: 100, maxH: 300, minW: 60, maxW: 130, fill: '#21194f', windows: 'rgba(255,214,110,0.75)' });
      K.skyline(ctx, 1280, 720, 720, { seed: 33, minH: 40, maxH: 160, minW: 80, maxW: 160, fill: '#120d30', windows: 'rgba(255,200,90,0.6)' });
      // rooftop ledge in front
      ctx.fillStyle = INK;
      ctx.fillRect(700, HY, 580, 80);
      ctx.fillStyle = '#1c1640'; ctx.fillRect(700, HY, 580, 8);
      ctx.fillStyle = INK; ctx.fillRect(1150, HY - 90, 60, 90); ctx.fillRect(1130, HY - 104, 100, 16);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.05, vignette: 0.5 });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // searchlights
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, a0, ph] of BEAMS) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a0 + Math.sin(t * 0.55 + ph) * 0.32);
        ctx.drawImage(beam, -110, -760, 220, 760);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      // cape (behind the body), billowing to the left
      ctx.save(); ctx.translate(HX, HY);
      ctx.beginPath();
      ctx.moveTo(-40, -198); ctx.lineTo(40, -198);
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        pts.push([40 - u * 230 + Math.sin(t * 4 - u * 4) * 10 * u, -40 + u * 18 + Math.sin(t * 5.3 - u * 5) * 16 * u]);
      }
      ctx.quadraticCurveTo(70, -120, pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.quadraticCurveTo(-170, -150, -40, -198);
      ctx.closePath();
      ctx.fillStyle = '#7a0f22'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#35e0ff'; ctx.stroke();
      ctx.drawImage(body, -120, -290, 240, 300);
      ctx.restore();
      const st = M.intro(t, 'zoom', { t0: 0.03, dur: 0.3, rot0: -0.45 });
      M.drawLogo(ctx, L, 640, 226, st, t, { breathe: [0.01, 0.8], shine: M.sweep(t, 0.6, 0.4, 4) });
      M.drawPrompt(ctx, prompt, 300, 662, t, { t0: 0.5, hz: 1.3 });
      ctx.restore();
    },
  };
}
