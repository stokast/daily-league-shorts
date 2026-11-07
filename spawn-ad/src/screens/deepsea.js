// ABYSS DIVER: deep sea. Blue depths with light rays, bubbles, a diver with a torch, an anglerfish's glowing lure;
// cyan Righteous logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'deepsea', title: 'ABYSS DIVER', word: 'deep sea', aspect: 16 / 9 };

const NAVY = '#021a33';
const DIVER = [300, 470], FISH = [1010, 596];
const LURE = [-214, -126]; // lure position relative to the fish

function diver(c) {
  // swimming to the right, slightly head-down; origin = chest
  c.lineCap = 'round'; c.lineJoin = 'round';
  K.roundRect(c, -70, -44, 110, 30, 14); c.fill(); c.stroke();          // tank
  c.beginPath(); c.ellipse(-10, 0, 74, 28, 0.12, 0, K.TAU); c.fill(); c.stroke(); // torso
  c.beginPath(); c.arc(78, 12, 30, 0, K.TAU); c.fill(); c.stroke();      // helmet
  c.lineWidth = 20;
  c.beginPath(); c.moveTo(30, 10); c.lineTo(80, 44); c.lineTo(128, 50); c.stroke();  // arm with torch
  c.beginPath(); c.moveTo(-74, 0); c.lineTo(-150, -10); c.stroke();     // legs
  c.beginPath(); c.moveTo(-74, 14); c.lineTo(-146, 26); c.stroke();
  K.roundRect(c, 118, 40, 34, 18, 6); c.fill();
}

function angler(c) {
  // facing left; origin = body centre
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-150, -10);
  c.quadraticCurveTo(-120, -120, 10, -110);
  c.quadraticCurveTo(140, -100, 190, -20);
  c.lineTo(270, -70); c.lineTo(250, 0); c.lineTo(270, 70); c.lineTo(190, 30);
  c.quadraticCurveTo(120, 110, 0, 104);
  c.quadraticCurveTo(-110, 100, -150, 40);
  c.lineTo(-90, 20); c.lineTo(-150, -10);
  c.closePath(); c.fill(); c.stroke();
  // fins
  M.poly(c, [20, -104, 60, -160, 90, -100]); c.fill(); c.stroke();
  M.poly(c, [40, 70, 90, 140, 110, 66]); c.fill(); c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const cyan = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#e6ffff'], [0.45, '#6ff3ff'], [1, '#13a0d0']]);
  const L = M.makeLogo(s, 1240, 420, (c, text) => {
    const base = { fill: cyan, outlines: [[34, NAVY], [10, '#2bc8f0']], extrude: { dx: 0, dy: 13, steps: 13, color: '#010d1d' }, glow: { color: 'rgba(40,220,255,0.75)', blur: 44 }, highlight: { color: 'rgba(255,255,255,0.5)', height: 0.32 } };
    text('ABYSS', 620, 196, { ...base, font: K.font(400, 232, 'Righteous'), tracking: 0.05 });
    text('DIVER', 620, 370, { ...base, font: K.font(400, 182, 'Righteous'), tracking: 0.12 });
    // bubbles on the logo
    c.lineWidth = 6;
    for (const [x, y, r] of [[1010, 250, 22], [1050, 196, 14], [1034, 152, 9]]) {
      c.strokeStyle = NAVY; c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.stroke();
      c.strokeStyle = '#bff8ff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.stroke(); c.lineWidth = 6;
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, K.TAU); c.fill();
    }
  });
  let shimmer = null;
  const bubble = M.sprite(40, 40, s, (c) => {
    c.strokeStyle = 'rgba(210,250,255,0.85)'; c.lineWidth = 3; c.beginPath(); c.arc(20, 20, 16, 0, K.TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(14, 14, 4, 0, K.TAU); c.fill();
  });
  const diverS = M.sprite(340, 160, s, (c) => {
    c.translate(170, 70); c.rotate(0.14);
    c.fillStyle = '#031426'; c.strokeStyle = '#3fd6ff'; c.lineWidth = 5; diver(c);
    c.strokeStyle = 'rgba(0,0,0,0)'; c.lineWidth = 0.01; diver(c);
    c.fillStyle = '#8ff6ff'; c.beginPath(); c.ellipse(90, 8, 12, 9, 0.3, 0, K.TAU); c.fill(); // visor glint
  });
  const fishS = M.sprite(560, 340, s, (c) => {
    c.translate(260, 170);
    c.fillStyle = '#020a16'; c.strokeStyle = 'rgba(60,200,255,0.55)'; c.lineWidth = 5; angler(c);
    // jaw + teeth
    c.fillStyle = '#01050c'; c.beginPath(); c.moveTo(-150, -10); c.lineTo(-60, 20); c.lineTo(-150, 40); c.closePath(); c.fill();
    c.fillStyle = '#d7f2ff';
    for (let i = 0; i < 6; i++) { const x = -146 + i * 15; M.poly(c, [x, -8 + i * 4.6, x + 9, -6 + i * 4.6, x + 6, 8 + i * 4.6]); c.fill(); M.poly(c, [x, 38 - i * 3.3, x + 9, 36 - i * 3.3, x + 5, 24 - i * 3.3]); c.fill(); }
    c.fillStyle = '#e8fbff'; c.beginPath(); c.arc(-70, -46, 13, 0, K.TAU); c.fill();
    c.fillStyle = '#020a16'; c.beginPath(); c.arc(-73, -46, 6, 0, K.TAU); c.fill();
    // stalk
    c.strokeStyle = '#06182c'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-40, -104); c.quadraticCurveTo(-120, -210, LURE[0], LURE[1]); c.stroke();
  });
  const lure = M.glow(s, 170, [[0, 'rgba(245,255,215,1)'], [0.1, 'rgba(160,255,225,0.95)'], [0.35, 'rgba(40,220,255,0.38)'], [1, 'rgba(0,140,255,0)']]);
  const beam = M.sprite(520, 220, s, (c) => {
    c.fillStyle = K.linGrad(c, 0, 0, 520, 0, [[0, 'rgba(200,250,255,0.55)'], [1, 'rgba(160,230,255,0)']]);
    M.poly(c, [0, 100, 0, 120, 520, 220, 520, 0]); c.fill();
  });
  const prompt = M.makePrompt(s, 'PRESS START', { font: 'Righteous', px: 32, fill: '#8ff6ff', tracking: 0.24, padY: 8 });
  const bub = M.field(30, 121), snow = M.field(40, 122), fishes = M.field(10, 123);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#0b86b8'], [0.35, '#065a8e'], [0.7, '#032a52'], [1, '#010a18']]);
      ctx.fillRect(0, 0, 1280, 720);
      // surface shimmer
      ctx.strokeStyle = 'rgba(190,250,255,0.35)'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= 1280; x += 16) ctx.lineTo(x, 10 + k * 14 + Math.sin(x * 0.03 + k * 2) * 5); ctx.stroke(); }
      // light rays
      for (let i = 0; i < 7; i++) {
        const x = 60 + i * 190, ww = 50 + (i % 3) * 30;
        ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 520, [[0, 'rgba(170,240,255,0.3)'], [1, 'rgba(170,240,255,0)']]);
        M.poly(ctx, [x, 0, x + ww, 0, x + ww + 170, 520, x + 100, 520]); ctx.fill();
      }
      // distant rock spires + kelp
      ctx.fillStyle = '#04223f';
      M.poly(ctx, [0, 720, 0, 430, 60, 400, 110, 470, 150, 380, 220, 470, 260, 720]); ctx.fill();
      M.poly(ctx, [1060, 720, 1110, 420, 1160, 450, 1200, 360, 1250, 430, 1280, 400, 1280, 720]); ctx.fill();
      ctx.fillStyle = '#021428';
      M.wavePath(ctx, 0, 1280, 660, [[20, 0.01, 1], [10, 0.03, 2]]); ctx.fill();
      ctx.strokeStyle = '#03321f'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      for (const [x, hh] of [[60, 220], [100, 160], [180, 250], [1180, 200], [1230, 260]]) {
        ctx.beginPath(); ctx.moveTo(x, 720); for (let y = 0; y < hh; y += 20) ctx.lineTo(x + Math.sin(y * 0.05 + x) * 14, 720 - y); ctx.stroke();
      }
      ctx.drawImage(fishS, FISH[0] - 260, FISH[1] - 170, 560, 340);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.05, vignette: 0.6, vColor: '0,5,20' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // swaying light rays
      if (!shimmer) shimmer = K.linGrad(ctx, 0, 0, 0, 460, [[0, 'rgba(200,250,255,0.22)'], [1, 'rgba(200,250,255,0)']]);
      ctx.fillStyle = shimmer;
      for (let i = 0; i < 2; i++) {
        const x = M.wrap(200 + i * 640 + t * 26, -200, 1400), ww = 70;
        M.poly(ctx, [x, 0, x + ww, 0, x + ww + 150, 460, x + 90, 460]); ctx.fill();
      }
      // small fish school
      ctx.fillStyle = 'rgba(120,220,255,0.55)';
      for (const f of fishes) {
        const x = M.wrap(1300 - t * (50 + f.a * 20) - f.b * 300, -60, 1340), y = 120 + f.c * 90 + Math.sin(t * 2 + f.d * 6) * 8;
        M.poly(ctx, [x, y, x + 22, y - 7, x + 22, y + 7]); ctx.fill();
        M.poly(ctx, [x + 20, y, x + 30, y - 6, x + 30, y + 6]); ctx.fill();
      }
      // anglerfish lurking (body in bg), lure pulsing
      const fy = FISH[1];
      const pulse = 0.65 + 0.35 * Math.sin(t * 3.2);
      const lx = FISH[0] + LURE[0], ly = fy + LURE[1];
      ctx.globalAlpha = pulse;
      M.put(ctx, lure, lx, ly);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f6ffe6'; ctx.beginPath(); ctx.arc(lx, ly, 11 + 2 * pulse, 0, K.TAU); ctx.fill();
      // diver with a torch beam
      const dy = Math.sin(t * 1.1) * 10;
      ctx.save(); ctx.translate(DIVER[0] + 150, DIVER[1] + 60 + dy); ctx.rotate(0.28); ctx.globalAlpha = 0.8;
      ctx.drawImage(beam, 0, -110, 520, 220); ctx.restore();
      ctx.drawImage(diverS, DIVER[0] - 170, DIVER[1] - 70 + dy, 340, 160);
      // fins kicking
      ctx.fillStyle = '#031426';
      for (const [ox, oy, ph] of [[-150, -12, 0], [-146, 24, Math.PI]]) {
        const a = Math.sin(t * 6 + ph) * 0.35;
        ctx.save(); ctx.translate(DIVER[0] + ox, DIVER[1] + oy + dy); ctx.rotate(a + 0.14);
        M.poly(ctx, [0, -6, -54, -22, -58, 18, 0, 8]); ctx.fill();
        ctx.restore();
      }
      // bubbles
      for (let i = 0; i < bub.length; i++) {
        const b = bub[i];
        const fromDiver = i < 10;
        const life = M.wrap(t * (0.25 + b.a * 0.2) + b.b, 0, 1);
        const x = (fromDiver ? DIVER[0] + 100 : b.c * 1280) + Math.sin(t * 3 + b.d * 6) * 8;
        const y = (fromDiver ? DIVER[1] + dy : 720) - life * (fromDiver ? 470 : 720);
        const r = 4 + b.e * (fromDiver ? 7 : 10);
        ctx.globalAlpha = 0.9 * (1 - life * 0.6);
        ctx.drawImage(bubble, x - r * 1.25, y - r * 1.25, r * 2.5, r * 2.5);
      }
      ctx.globalAlpha = 1;
      // marine snow
      ctx.fillStyle = 'rgba(200,240,255,0.45)';
      for (const p of snow) ctx.fillRect(M.wrap(p.a * 1280 + Math.sin(t * 0.5 + p.b * 6) * 20, 0, 1280), M.wrap(p.c * 720 + t * (6 + p.d * 8), 0, 720), 2.5, 2.5);
      const st = M.intro(t, 'rise', { t0: 0.03, dur: 0.32, dist: 260 });
      M.drawLogo(ctx, L, 640, 226, st, t, { bob: [5, 0.32], shine: M.sweep(t, 0.65, 0.55, 4.6), shineOpts: { color: '220,255,255', alpha: 0.75 } });
      M.drawPrompt(ctx, prompt, 640, 676, t, { t0: 0.55, mode: 'pulse', hz: 0.6 });
      ctx.restore();
    },
  };
}
