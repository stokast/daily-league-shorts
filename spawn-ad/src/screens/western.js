// HIGH NOON: western. Blazing desert, a huge sun, mesas, saguaros, a lone cowboy; gold Rye letters on a
// hanging wooden sign.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'western', title: 'HIGH NOON', word: 'western', aspect: 16 / 9 };

const DARK = '#1c0d07';

function saguaro(c, x, y, hgt, k, col) {
  c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  K.roundRect(c, -22, -hgt, 44, hgt + 10, 22); c.fill();
  c.lineWidth = 30;
  c.beginPath(); c.moveTo(-10, -hgt * 0.42); c.lineTo(-62, -hgt * 0.42); c.lineTo(-62, -hgt * 0.72); c.stroke();
  c.beginPath(); c.moveTo(10, -hgt * 0.56); c.lineTo(58, -hgt * 0.56); c.lineTo(58, -hgt * 0.86); c.stroke();
  c.restore();
}

function cowboy(c) {
  // origin = feet; standing square to camera, hand by the holster, coat flaring
  c.fillStyle = DARK; c.strokeStyle = DARK; c.lineCap = 'round'; c.lineJoin = 'round';
  // hat
  c.beginPath(); c.ellipse(0, -268, 64, 12, 0, 0, K.TAU); c.fill();
  M.poly(c, [-34, -270, -28, -312, -8, -318, 0, -308, 8, -318, 28, -312, 34, -270]); c.fill();
  // head + neck
  c.beginPath(); c.arc(0, -246, 20, 0, K.TAU); c.fill();
  c.fillRect(-9, -232, 18, 16);
  // duster coat body
  M.poly(c, [-52, -218, 52, -218, 60, -150, 84, -70, 40, -64, 26, -120, -26, -120, -40, -64, -84, -70, -60, -150]); c.fill();
  // arms
  c.lineWidth = 22;
  c.beginPath(); c.moveTo(-52, -210); c.lineTo(-74, -150); c.lineTo(-66, -102); c.stroke();
  c.beginPath(); c.moveTo(52, -210); c.lineTo(80, -152); c.lineTo(70, -112); c.stroke();
  // holster + legs + boots
  K.roundRect(c, 46, -128, 22, 40, 6); c.fill();
  c.lineWidth = 26;
  c.beginPath(); c.moveTo(-18, -122); c.lineTo(-34, -10); c.moveTo(18, -122); c.lineTo(34, -10); c.stroke();
  c.beginPath(); c.ellipse(-40, -6, 24, 9, 0, 0, K.TAU); c.ellipse(40, -6, 24, 9, 0, 0, K.TAU); c.fill();
  // spurs
  c.fillStyle = '#ffcf6a'; c.beginPath(); c.arc(-62, -8, 4, 0, K.TAU); c.arc(62, -8, 4, 0, K.TAU); c.fill();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1260, 330, (c, text) => {
    // ropes to the top edge
    c.strokeStyle = '#6b4320'; c.lineWidth = 8; c.lineCap = 'round';
    for (const x of [250, 1010]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 70); c.stroke(); }
    // wooden sign: two planks
    const r = K.rng(4);
    for (const [y, hh, tilt] of [[56, 124, -0.006], [176, 112, 0.008]]) {
      c.save(); c.translate(630, y + hh / 2); c.rotate(tilt);
      c.fillStyle = DARK; K.roundRect(c, -608, -hh / 2 - 6, 1216, hh + 12, 12); c.fill();
      c.fillStyle = K.linGrad(c, 0, -hh / 2, 0, hh / 2, [[0, '#a8662e'], [0.5, '#8a4f22'], [1, '#6b3a17']]);
      K.roundRect(c, -600, -hh / 2, 1200, hh, 8); c.fill();
      c.strokeStyle = 'rgba(40,18,6,0.4)'; c.lineWidth = 3;
      for (let k = 0; k < 7; k++) {
        const yy = -hh / 2 + 10 + k * (hh - 20) / 6;
        c.beginPath(); c.moveTo(-590, yy);
        for (let x = -590; x <= 590; x += 40) c.lineTo(x, yy + Math.sin(x * 0.02 + k * 2 + r() * 0.5) * 3);
        c.stroke();
      }
      c.fillStyle = '#d9b47a';
      for (const x of [-580, 580]) for (const yy of [-hh / 2 + 14, hh / 2 - 14]) { c.beginPath(); c.arc(x, yy, 6, 0, K.TAU); c.fill(); }
      c.restore();
    }
    text('HIGH NOON', 630, 236, {
      font: K.font(400, 176, 'Rye'), tracking: 0.02,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff4c2'], [0.4, '#ffd36b'], [0.55, '#e8a23a'], [1, '#a8601c']]),
      outlines: [[24, DARK], [8, '#ffe8a8']], extrude: { dx: 0, dy: 9, steps: 9, color: DARK },
      highlight: { color: 'rgba(255,255,240,0.4)', height: 0.3 },
    });
  });
  const tumble = M.sprite(110, 110, s, (c) => {
    c.translate(55, 55); c.strokeStyle = '#8a5a2a'; c.lineWidth = 3;
    const r = K.rng(6);
    for (let i = 0; i < 26; i++) { c.beginPath(); const a = r() * K.TAU, b = a + 1 + r() * 2; c.arc((r() - 0.5) * 16, (r() - 0.5) * 16, 22 + r() * 22, a, b); c.stroke(); }
  });
  const cowboyS = M.sprite(220, 340, s, (c) => { c.translate(110, 330); cowboy(c); });
  const prompt = M.makePrompt(s, 'PRESS START', { font: 'Rye', px: 34, fill: '#ffd36b', stroke: DARK, strokeW: 5, tracking: 0.12, padY: 8 });
  const dust = M.field(18, 101);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 560, [[0, '#d9481c'], [0.45, '#ff8a2a'], [1, '#ffd37a']]);
      ctx.fillRect(0, 0, 1280, 720);
      // huge sun
      ctx.fillStyle = K.radGrad(ctx, 640, 420, 160, 620, [[0, 'rgba(255,240,170,0.7)'], [1, 'rgba(255,200,90,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.linGrad(ctx, 0, 190, 0, 650, [[0, '#fff1b0'], [1, '#ffc85a']]);
      ctx.beginPath(); ctx.arc(640, 420, 230, 0, K.TAU); ctx.fill();
      // heat bands across the sun
      ctx.fillStyle = 'rgba(255,150,60,0.45)';
      for (const [y, hh] of [[470, 8], [500, 10], [528, 13], [556, 16]]) ctx.fillRect(400, y, 480, hh);
      // mesas
      ctx.fillStyle = '#c4572c';
      M.poly(ctx, [0, 560, 0, 470, 60, 470, 90, 440, 250, 440, 280, 470, 330, 470, 360, 560]); ctx.fill();
      M.poly(ctx, [880, 560, 920, 480, 980, 480, 1000, 430, 1170, 430, 1200, 470, 1280, 470, 1280, 560]); ctx.fill();
      ctx.fillStyle = '#9b3f1f';
      M.poly(ctx, [140, 560, 180, 500, 330, 500, 380, 560]); ctx.fill();
      M.poly(ctx, [760, 560, 800, 510, 900, 510, 940, 560]); ctx.fill();
      // desert floor
      ctx.fillStyle = K.linGrad(ctx, 0, 556, 0, 720, [[0, '#e89a4e'], [1, '#c96f30']]);
      ctx.fillRect(0, 556, 1280, 164);
      ctx.strokeStyle = 'rgba(120,50,20,0.35)'; ctx.lineWidth = 3;
      const r = K.rng(8);
      for (let i = 0; i < 26; i++) { const x = r() * 1280, y = 590 + r() * 120, l = 20 + r() * 40; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (r() - 0.5) * 6); ctx.lineTo(x + l * 1.4, y + (r() - 0.5) * 10); ctx.stroke(); }
      // cowboy's shadow + cacti
      ctx.fillStyle = 'rgba(90,30,10,0.35)'; ctx.beginPath(); ctx.ellipse(640, 664, 120, 16, 0, 0, K.TAU); ctx.fill();
      saguaro(ctx, 120, 700, 300, 1.05, '#2a120a');
      saguaro(ctx, 1150, 690, 250, 0.95, '#2a120a');
      saguaro(ctx, 330, 600, 160, 0.5, '#5a2410');
      saguaro(ctx, 960, 590, 140, 0.45, '#5a2410');
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.06, vignette: 0.45, vColor: '60,15,0' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // vultures circling
      ctx.strokeStyle = DARK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.5 + i * 2.1;
        const x = 1040 + Math.cos(a) * (70 + i * 30), y = 360 + Math.sin(a) * 26 + i * 18;
        const f = Math.sin(t * 6 + i) * 6;
        ctx.beginPath(); ctx.moveTo(x - 20, y - 4 + f); ctx.lineTo(x, y); ctx.lineTo(x + 20, y - 4 + f); ctx.stroke();
      }
      // the lone cowboy (coat stirs a little)
      ctx.save(); ctx.translate(640, 666); ctx.transform(1, 0, Math.sin(t * 1.4) * 0.012, 1, 0, 0);
      ctx.drawImage(cowboyS, -110, -330, 220, 340);
      ctx.restore();
      // dust drifting + tumbleweed
      ctx.fillStyle = 'rgba(255,214,150,0.5)';
      for (const d of dust) { const x = M.wrap(d.a * 1280 + t * (60 + d.b * 60), 0, 1280), y = 600 + d.c * 110 + Math.sin(t * 2 + d.d * 6) * 6; ctx.fillRect(x, y, 4 + d.e * 6, 2); }
      const tx = M.wrap(-140 + t * 170, -140, 1420), ty = 668 - Math.abs(Math.sin(t * 4.2)) * 26;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(t * 5); ctx.drawImage(tumble, -55, -55, 110, 110); ctx.restore();
      // the sign swings in on its ropes
      const st = M.intro(t, 'swing', { t0: 0.02, dur: 0.3, dist: 340, rot0: -0.18 });
      M.drawLogo(ctx, L, 640, -4, st, t, { ay: 0, tilt: [0.006, 0.35], shine: M.sweep(t, 0.65, 0.5, 4.6), shineOpts: { color: '255,250,220', alpha: 0.75 } });
      M.drawPrompt(ctx, prompt, 640, 700, t, { t0: 0.55, hz: 1.1 });
      ctx.restore();
    },
  };
}
