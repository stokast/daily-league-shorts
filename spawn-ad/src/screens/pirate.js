// SKULL TIDE: pirate. Moonlit sea, a big moon, a ship silhouette, waves; gold Pirata One logo, dark outline.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'pirate', title: 'SKULL TIDE', word: 'pirate', aspect: 16 / 9 };

const INK = '#120a04';

function skullIcon(c, x, y, k) {
  c.save(); c.translate(x, y); c.scale(k, k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // crossbones
  for (const a of [0.7, -0.7]) {
    c.save(); c.rotate(a);
    c.lineWidth = 34; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(-82, 0); c.lineTo(82, 0); c.stroke();
    for (const e of [-82, 82]) { c.beginPath(); c.arc(e, -10, 17, 0, K.TAU); c.arc(e, 10, 17, 0, K.TAU); c.fillStyle = INK; c.fill(); }
    c.lineWidth = 16; c.strokeStyle = '#efe2bf';
    c.beginPath(); c.moveTo(-80, 0); c.lineTo(80, 0); c.stroke();
    for (const e of [-82, 82]) { c.fillStyle = '#efe2bf'; c.beginPath(); c.arc(e, -10, 10, 0, K.TAU); c.arc(e, 10, 10, 0, K.TAU); c.fill(); }
    c.restore();
  }
  // skull
  const skull = () => {
    c.beginPath();
    c.arc(0, -14, 50, Math.PI * 0.82, Math.PI * 0.18);
    c.lineTo(28, 34); c.lineTo(-28, 34); c.closePath();
  };
  skull(); c.lineWidth = 16; c.strokeStyle = INK; c.stroke();
  skull(); c.fillStyle = K.linGrad(c, 0, -64, 0, 34, [[0, '#fffbe9'], [1, '#d8c79a']]); c.fill();
  c.fillStyle = INK;
  c.beginPath(); c.ellipse(-19, -10, 14, 16, 0.2, 0, K.TAU); c.ellipse(19, -10, 14, 16, -0.2, 0, K.TAU); c.fill();
  M.poly(c, [0, 8, -7, 20, 7, 20]); c.fill();
  c.lineWidth = 4; c.strokeStyle = INK;
  for (const tx of [-14, 0, 14]) { c.beginPath(); c.moveTo(tx, 24); c.lineTo(tx, 34); c.stroke(); }
  c.restore();
}

function ship(c) {
  // origin = waterline centre; bow points left
  const col = '#05080f';
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  // rigging
  c.lineWidth = 2.5;
  for (const [x0, y0, x1, y1] of [[-110, -238, -292, -100], [0, -292, -292, -100], [0, -292, 182, -66], [105, -228, 186, -64], [-110, -238, -190, -46], [0, -292, -40, -38]]) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  // bowsprit + masts
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(-190, -50); c.lineTo(-296, -102); c.stroke();
  c.lineWidth = 9;
  for (const [x, top] of [[-110, -244], [0, -300], [105, -232]]) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x, top); c.stroke(); }
  // sails (billowing toward the bow)
  const sail = (x, y0, y1, hw) => {
    c.beginPath();
    c.moveTo(x - hw, y0); c.lineTo(x + hw, y0);
    c.quadraticCurveTo(x + hw + 6, (y0 + y1) / 2, x + hw * 0.92, y1);
    c.quadraticCurveTo(x - 8, y1 + 22, x - hw * 0.92, y1);
    c.quadraticCurveTo(x - hw - 16, (y0 + y1) / 2, x - hw, y0);
    c.fill();
    c.lineWidth = 6; c.beginPath(); c.moveTo(x - hw - 6, y0); c.lineTo(x + hw + 6, y0); c.stroke();
  };
  sail(-110, -228, -166, 50); sail(-110, -158, -74, 66);
  sail(0, -284, -212, 58); sail(0, -204, -122, 76); sail(0, -114, -52, 82);
  sail(105, -218, -156, 46); sail(105, -148, -82, 58);
  // jib
  M.poly(c, [-118, -228, -282, -104, -168, -66]); c.fill();
  // tatters
  c.globalCompositeOperation = 'destination-out';
  for (const [x, y, sz] of [[-140, -70, 12], [-82, -62, 9], [-30, -112, 11], [44, -110, 8], [-18, -46, 10], [90, -78, 10], [128, -152, 8], [20, -206, 9]]) {
    M.poly(c, [x - sz, y + 8, x, y - sz, x + sz, y + 8]); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // flag
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, -300);
  c.quadraticCurveTo(26, -312, 58, -300); c.lineTo(62, -272); c.quadraticCurveTo(30, -284, 0, -274); c.closePath(); c.fill();
  c.fillStyle = '#cfc6b0';
  c.beginPath(); c.arc(30, -289, 6.5, 0, K.TAU); c.fill();
  // hull
  M.poly(c, [-208, -56, -150, -38, 95, -36, 118, -64, 182, -68, 192, -40, 176, 0, 140, 22, -130, 22, -186, -8]);
  c.fillStyle = col; c.fill();
  // rail + stern lanterns
  c.lineWidth = 3; c.strokeStyle = '#1b2a40';
  c.beginPath(); c.moveTo(-150, -30); c.lineTo(95, -28); c.stroke();
  c.fillStyle = '#ffb347';
  for (const [x, y] of [[150, -48], [166, -48], [150, -32], [166, -32]]) c.fillRect(x - 5, y - 5, 10, 9);
  c.fillStyle = '#16233a';
  for (let x = -110; x < 90; x += 34) { c.beginPath(); c.arc(x, -12, 5, 0, K.TAU); c.fill(); }
}

function waveStrip(s, P, H, base, A, fillTop, fillBot, crest, foam, seed) {
  const W = 1280 + P;
  return M.sprite(W, H, s, (c) => {
    const y = (x) => base + A * Math.sin((x / P) * K.TAU) + A * 0.35 * Math.sin((x / P) * K.TAU * 2 + 1.3);
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) c.lineTo(x, y(x));
    c.lineTo(W, H); c.closePath();
    c.fillStyle = K.linGrad(c, 0, base - A, 0, H, [[0, fillTop], [1, fillBot]]); c.fill();
    c.lineWidth = 5; c.strokeStyle = crest;
    c.beginPath();
    for (let x = 0; x <= W; x += 4) { const yy = y(x); if (x) c.lineTo(x, yy); else c.moveTo(x, yy); }
    c.stroke();
    const r = K.rng(seed);
    c.fillStyle = foam;
    for (let i = 0; i < 70; i++) {
      const x = (r() * W) % W, yy = y(x) + 6 + r() * 26;
      c.fillRect(x, yy, 6 + r() * 16, 2.5);
    }
  });
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 300, (c, text) => {
    const opts = {
      font: K.font(400, 236, 'Pirata One'),
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff6c2'], [0.38, '#ffd659'], [0.52, '#e9a92c'], [0.8, '#b8741a'], [1, '#7a4a10']]),
      outlines: [[34, INK], [14, '#6b3c0e']],
      extrude: { dx: 0, dy: 15, steps: 15, color: '#0a0603' },
      highlight: { color: 'rgba(255,255,235,0.35)', height: 0.3 },
    };
    c.font = opts.font;
    const gap = 108;
    skullIcon(c, 620, 140, 0.8);
    text('SKULL', 620 - gap, 222, { ...opts, align: 'right' });
    text('TIDE', 620 + gap, 222, { ...opts, align: 'left' });
  });
  const shipSpr = M.sprite(520, 360, s, (c) => { c.translate(310, 330); ship(c); });
  const wavesMid = waveStrip(s, 256, 225, 40, 9, '#0d2a47', '#071526', '#3f7fa8', 'rgba(150,200,230,0.35)', 3);
  const wavesFront = waveStrip(s, 320, 170, 40, 16, '#08192b', '#02070f', '#4b8bb0', 'rgba(170,215,240,0.4)', 4);
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Pirata One', px: 40, fill: '#ffd76a', stroke: INK, strokeW: 5, tracking: 0.14, padY: 8,
  });
  const glit = M.field(34, 21);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 410, [[0, '#050a1c'], [0.55, '#0f2547'], [1, '#2a5f86']]);
      ctx.fillRect(0, 0, 1280, 720);
      K.stars(ctx, 1280, 720, { n: 150, seed: 12, yMax: 380, maxR: 2.2 });
      ctx.fillStyle = K.radGrad(ctx, 640, 210, 140, 560, [[0, 'rgba(255,236,180,0.45)'], [0.4, 'rgba(160,190,230,0.15)'], [1, 'rgba(60,90,140,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      // moon
      ctx.fillStyle = K.radGrad(ctx, 600, 165, 20, 195, [[0, '#fffbe6'], [0.7, '#f6eac0'], [1, '#e4d29a']]);
      ctx.beginPath(); ctx.arc(640, 210, 180, 0, K.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(190,170,120,0.22)';
      for (const [x, y, r] of [[570, 150, 30], [700, 130, 20], [716, 270, 40], [596, 290, 18], [664, 196, 14], [532, 228, 12]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, K.TAU); ctx.fill();
      }
      // cloud wisps: soft, tapered streaks
      const wr = K.rng(77);
      for (const [x, y, ww, hh] of [[440, 74, 300, 18], [600, 96, 360, 14], [920, 118, 260, 16], [60, 150, 300, 20], [990, 236, 300, 16], [120, 284, 260, 14], [430, 330, 200, 12]]) {
        for (let k = 0; k < 5; k++) {
          const cx = x + ww * (0.15 + 0.7 * wr()), rw = ww * (0.25 + 0.25 * wr()), rh = hh * (0.5 + 0.5 * wr());
          ctx.fillStyle = `rgba(9,18,40,${(0.35 + 0.3 * wr()).toFixed(2)})`;
          ctx.beginPath(); ctx.ellipse(cx, y + (wr() - 0.5) * hh, rw, rh, 0, 0, K.TAU); ctx.fill();
        }
      }
      // horizon sea
      ctx.fillStyle = K.linGrad(ctx, 0, 405, 0, 720, [[0, '#1f5279'], [0.22, '#0f2c4b'], [1, '#040d1a']]);
      ctx.fillRect(0, 405, 1280, 315);
      ctx.fillStyle = 'rgba(255,240,200,0.3)'; ctx.fillRect(0, 404, 1280, 3);
      // distant islands
      ctx.fillStyle = '#081628';
      ctx.beginPath(); ctx.moveTo(30, 408); ctx.quadraticCurveTo(120, 360, 230, 380); ctx.quadraticCurveTo(290, 390, 320, 408); ctx.fill();
      for (const [x, y, hgt, lean] of [[120, 375, 70, -0.25], [168, 374, 56, 0.2]]) {
        ctx.lineWidth = 5; ctx.strokeStyle = '#081628';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 40, y - hgt * 0.6, x + lean * 70, y - hgt); ctx.stroke();
        ctx.fillStyle = '#081628';
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * 0.7;
          ctx.beginPath(); ctx.ellipse(x + lean * 70 + Math.cos(a) * 18, y - hgt + Math.sin(a) * 10 + 6, 22, 5, a, 0, K.TAU); ctx.fill();
        }
      }
      ctx.beginPath(); ctx.moveTo(1080, 408); ctx.lineTo(1120, 350); ctx.lineTo(1145, 360); ctx.lineTo(1170, 330); ctx.lineTo(1205, 408); ctx.fill();
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.04, vignette: 0.55 });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // moon glitter on the water
      for (const g of glit) {
        const y = 412 + g.a * 150;
        const spread = 30 + (y - 410) * 0.9;
        const x = 640 + (g.b - 0.5) * spread * 2;
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * (2.2 + g.c * 3) + g.d * 9));
        ctx.fillStyle = `rgba(255,240,196,${(a * 0.8).toFixed(3)})`;
        ctx.fillRect(x, y, 10 + g.e * 34, 2.5);
      }
      // ship rocking
      ctx.save();
      ctx.translate(690, 432 + Math.sin(t * 1.3) * 4);
      ctx.rotate(Math.sin(t * 0.95) * 0.04);
      ctx.scale(0.8, 0.8);
      ctx.drawImage(shipSpr, -310, -330, 520, 360);
      ctx.restore();
      // waves
      const P1 = 256, P2 = 320;
      M.blit(ctx, wavesMid, -((t * 22) % P1), 400, s);
      M.blit(ctx, wavesFront, -P2 + ((t * 34) % P2), 560, s);
      // logo
      const st = M.intro(t, 'stamp', { t0: 0.03, dur: 0.26, from: 1.45, rot0: -0.2, rot1: -0.035 });
      M.drawLogo(ctx, L, 640, 506, st, t, { bob: [3, 0.35], shine: M.sweep(t, 0.62, 0.5, 4.2), shineOpts: { color: '255,250,220', alpha: 0.8 } });
      M.drawPrompt(ctx, prompt, 640, 684, t, { t0: 0.5, hz: 1.1 });
      ctx.restore();
    },
  };
}
