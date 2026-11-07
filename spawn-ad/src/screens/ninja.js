// SHADOW CLAN: ninja. Huge red moon, bamboo silhouettes, a leaping ninja, drifting petals; sliced white/red logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'ninja', title: 'SHADOW CLAN', word: 'ninja', aspect: 16 / 9 };

const INK = '#060203';

function ninja(c) {
  c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (lw, x0, y0, x1, y1) => { c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  // katana
  c.beginPath(); c.moveTo(116, -66); c.quadraticCurveTo(190, -112, 262, -146); c.lineTo(258, -136); c.quadraticCurveTo(190, -100, 120, -56); c.closePath(); c.fill();
  line(11, 96, -48, 120, -64);
  line(5, 108, -76, 126, -50);
  // legs
  line(32, -6, 16, -66, 40); line(25, -66, 40, -126, 28);
  c.beginPath(); c.ellipse(-138, 26, 18, 9, -0.15, 0, K.TAU); c.fill();
  line(32, 0, 12, 46, 44); line(25, 46, 44, 14, 76);
  c.beginPath(); c.ellipse(6, 80, 17, 9, 0.5, 0, K.TAU); c.fill();
  // torso + belt sash
  line(46, -2, 10, 50, -30);
  // head + hood knot tails
  c.beginPath(); c.arc(76, -54, 25, 0, K.TAU); c.fill();
  // arms
  line(19, 52, -30, 86, -38); line(16, 86, -38, 104, -56);
  line(19, 40, -26, 8, -56); line(16, 8, -56, -30, -64);
  c.beginPath(); c.arc(-34, -64, 9, 0, K.TAU); c.fill();
  // eye slit
  c.fillStyle = '#ff5b4a';
  c.beginPath(); c.ellipse(90, -58, 9, 2.6, -0.25, 0, K.TAU); c.fill();
}

function bamboo(c, x, h, wdt, lean, col, seed, rim = null) {
  const r = K.rng(seed);
  c.save(); c.translate(x, 740); c.rotate(lean);
  c.fillStyle = col; c.strokeStyle = col;
  c.fillRect(-wdt / 2, -h, wdt, h);
  if (rim) { c.fillStyle = rim; c.fillRect(rim.side > 0 ? wdt / 2 - 4 : -wdt / 2, -h, 4, h); c.fillStyle = col; }
  for (let y = -40 - r() * 60; y > -h; y -= 80 + r() * 50) {
    c.fillRect(-wdt / 2 - 3, y - 4, wdt + 6, 8);
    if (r() < 0.55) {
      const dir = r() < 0.5 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        c.save(); c.translate(dir * wdt * 0.4, y - 4); c.rotate(dir * (0.5 + k * 0.32) + (dir < 0 ? Math.PI : 0));
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(38, -10, 92 - k * 14, 0); c.quadraticCurveTo(38, 8, 0, 0); c.fill();
        c.restore();
      }
    }
  }
  c.restore();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 400, (c, text, fx) => {
    // SHADOW drawn to temp canvases, then pasted in two halves along a sword cut
    const tmp = K.makeCanvas(1240 * s, 400 * s), tf = K.makeCanvas(1240 * s, 400 * s);
    const tc = tmp.getContext('2d'), tfc = tf.getContext('2d');
    tc.scale(s, s); tfc.scale(s, s);
    const opts = {
      font: K.font(600, 300, 'Teko'), tracking: 0.03,
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#ffffff'], [0.6, '#f1eeee'], [1, '#c9c2c4']]),
      outlines: [[36, INK], [12, '#8f0d16']],
      extrude: { dx: 6, dy: 14, steps: 14, color: '#2a0306' },
    };
    K.logoText(tc, 'SHADOW', 620, 226, opts);
    K.logoText(tfc, 'SHADOW', 620, 226, { font: opts.font, tracking: opts.tracking, fill: '#fff' });
    const cut = (ctx2, src, upper) => {
      ctx2.save();
      ctx2.beginPath();
      if (upper) { ctx2.moveTo(0, 0); ctx2.lineTo(1240, 0); ctx2.lineTo(1240, 60); ctx2.lineTo(0, 210); }
      else { ctx2.moveTo(0, 210); ctx2.lineTo(1240, 60); ctx2.lineTo(1240, 400); ctx2.lineTo(0, 400); }
      ctx2.closePath(); ctx2.clip();
      ctx2.drawImage(src, upper ? 12 : 0, upper ? -7 : 0, 1240, 400);
      ctx2.restore();
    };
    cut(c, tmp, false); cut(c, tmp, true); cut(fx, tf, false); cut(fx, tf, true);
    // the slash line
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,40,50,0.55)'; c.lineWidth = 12;
    c.beginPath(); c.moveTo(120, 230); c.lineTo(1150, 46); c.stroke();
    c.strokeStyle = '#fff4f0'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(120, 230); c.lineTo(1150, 46); c.stroke();
    c.restore();
    // CLAN on a red brush band
    const r = K.rng(8);
    c.beginPath();
    c.moveTo(380, 284);
    for (let x = 380; x <= 860; x += 20) c.lineTo(x, 280 + r() * 10 - (x > 820 ? (x - 820) * 0.3 : 0));
    c.lineTo(900, 300); c.lineTo(872, 330);
    for (let x = 860; x >= 380; x -= 20) c.lineTo(x, 378 + r() * 10);
    c.lineTo(340, 350); c.lineTo(362, 320); c.closePath();
    c.fillStyle = INK; c.save(); c.translate(0, 8); c.fill(); c.restore();
    c.fillStyle = K.linGrad(c, 0, 280, 0, 390, [[0, '#ff3340'], [1, '#b80f1d']]); c.fill();
    c.strokeStyle = 'rgba(255,120,120,0.5)'; c.lineWidth = 3;
    for (let k = 0; k < 6; k++) { const y = 292 + k * 15; c.beginPath(); c.moveTo(372 + r() * 40, y); c.lineTo(830 + r() * 50, y + 2); c.stroke(); }
    text('CLAN', 620, 372, { font: K.font(600, 150, 'Teko'), fill: '#ffffff', tracking: 0.32, outlines: [[14, INK]] });
  });
  const ninjaSpr = M.sprite(440, 260, s, (c) => { c.translate(170, 150); ninja(c); });
  const bambooL = M.sprite(300, 760, s, (c) => {
    bamboo(c, 40, 780, 30, 0.05, INK, 1); bamboo(c, 110, 700, 24, -0.02, INK, 2); bamboo(c, 175, 820, 20, 0.08, INK, 3);
  });
  const bambooR = M.sprite(300, 760, s, (c) => {
    bamboo(c, 260, 800, 30, -0.05, INK, 4); bamboo(c, 190, 690, 22, 0.03, INK, 5); bamboo(c, 120, 760, 18, -0.1, INK, 6);
  });
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Teko', weight: 600, px: 46, fill: '#ffffff', tracking: 0.32, padX: 56, padY: 4,
    plate: (x, pw, ph) => {
      x.fillStyle = '#ff3340';
      for (const cx of [20, pw - 20]) { x.beginPath(); x.moveTo(cx, ph / 2 - 9); x.lineTo(cx + 9, ph / 2); x.lineTo(cx, ph / 2 + 9); x.lineTo(cx - 9, ph / 2); x.fill(); }
    },
  });
  const petals = M.field(34, 51);
  const petal = (col) => M.sprite(18, 12, s, (c) => { c.fillStyle = col; c.beginPath(); c.ellipse(9, 6, 8, 5, 0, 0, K.TAU); c.fill(); });
  const petalA = petal('#ff9fb9'), petalB = petal('#ffd0dc');

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#0d0306'], [0.6, '#22060b'], [1, '#0a0204']]);
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = K.radGrad(ctx, 640, 250, 200, 640, [[0, 'rgba(255,40,40,0.45)'], [0.35, 'rgba(160,10,30,0.2)'], [1, 'rgba(60,0,10,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      K.stars(ctx, 1280, 720, { n: 70, seed: 3, yMax: 300, color: '255,200,200', maxR: 1.6 });
      // the moon
      ctx.fillStyle = K.radGrad(ctx, 600, 190, 30, 250, [[0, '#ff6a48'], [0.55, '#ef3a31'], [1, '#c01824']]);
      ctx.beginPath(); ctx.arc(640, 250, 236, 0, K.TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(640, 250, 236, 0, K.TAU); ctx.clip();
      ctx.fillStyle = 'rgba(120,0,10,0.18)';
      for (const [x, y, r] of [[560, 170, 50], [720, 140, 30], [730, 310, 64], [560, 340, 34], [660, 230, 22], [500, 250, 26], [800, 230, 20]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, K.TAU); ctx.fill();
      }
      ctx.restore();
      // far bamboo (dark red) + mist bands
      bamboo(ctx, 300, 640, 16, 0.04, '#3a0b12', 11); bamboo(ctx, 360, 560, 12, -0.03, '#3a0b12', 12);
      bamboo(ctx, 930, 600, 16, -0.02, '#3a0b12', 13); bamboo(ctx, 990, 680, 13, 0.05, '#3a0b12', 14);
      ctx.fillStyle = 'rgba(20,2,6,0.55)';
      for (const [x, y, ww, hh] of [[300, 330, 420, 12], [560, 360, 460, 10], [380, 395, 520, 14]]) { K.roundRect(ctx, x, y, ww, hh, hh / 2); ctx.fill(); }
      // red haze low in the frame so the black bamboo reads
      ctx.fillStyle = K.linGrad(ctx, 0, 260, 0, 660, [[0, 'rgba(150,14,30,0)'], [0.7, 'rgba(150,14,30,0.42)'], [1, 'rgba(110,8,20,0.5)']]);
      ctx.fillRect(0, 260, 1280, 400);
      for (const x of [110, 1170]) {
        ctx.fillStyle = K.radGrad(ctx, x, 470, 0, 260, [[0, 'rgba(170,20,36,0.4)'], [1, 'rgba(170,20,36,0)']]);
        ctx.fillRect(x - 260, 210, 520, 520);
      }
      // ground
      M.wavePath(ctx, 0, 1280, 640, [[14, 0.01, 1], [6, 0.03, 2]]);
      ctx.fillStyle = INK; ctx.fill();
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.05, vignette: 0.6 });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // the leaping ninja, frozen mid-air with a fluttering scarf
      const nx = 520 + Math.sin(t * 0.7) * 6, ny = 168 + Math.sin(t * 1.1) * 5;
      ctx.save(); ctx.translate(nx, ny);
      ctx.fillStyle = INK;
      ctx.beginPath();
      const pts = [];
      for (let k = 0; k <= 9; k++) pts.push([62 - k * 24, -40 + k * 3 + Math.sin(t * 9 - k * 0.8) * k * 2.4, 7 - k * 0.5]);
      pts.forEach(([x, y, hw], i) => (i ? ctx.lineTo(x, y - hw) : ctx.moveTo(x, y - hw)));
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], pts[k][1] + pts[k][2]);
      ctx.closePath(); ctx.fill();
      ctx.drawImage(ninjaSpr, -170, -150, 440, 260);
      ctx.restore();
      // swaying bamboo (whole-pixel shifts keep this on the fast blit path)
      for (const [spr, x, ph] of [[bambooL, 0, 0], [bambooR, 980, 1.7]]) {
        const dx = Math.round(Math.sin(t * 0.9 + ph) * 5 * s) / s;
        ctx.drawImage(spr, x + dx, -20, 300, 760);
      }
      // petals: sprites placed with setTransform composed onto the current matrix (no paths, no save/restore)
      const m = ctx.getTransform();
      for (const p of petals) {
        const x = M.wrap(p.a * 1500 - t * (40 + p.b * 50), -60, 1340);
        const y = M.wrap(p.c * 760 + t * (30 + p.d * 40), -20, 740);
        const rot = t * (1.5 + p.e * 2) + p.f * 6;
        const cs = Math.cos(rot), sn = Math.sin(rot), k = Math.abs(Math.cos(rot * 1.3)) * 0.8 + 0.2;
        ctx.setTransform(m.a * cs + m.c * sn, m.b * cs + m.d * sn, (-m.a * sn + m.c * cs) * k, (-m.b * sn + m.d * cs) * k,
          m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
        ctx.drawImage(p.f < 0.5 ? petalA : petalB, -9, -6, 18, 12);
      }
      ctx.setTransform(m);
      // logo: sliced in
      const st = M.intro(t, 'slice', { t0: 0.05, dur: 0.24 });
      M.drawLogo(ctx, L, 640, 452, st, t, { bob: [2.5, 0.3], shine: M.sweep(t, 0.7, 0.4, 5), shineOpts: { alpha: 0.6, color: '255,220,220' } });
      if (st.p > 0 && st.p < 1) {
        const x = 20 + 1240 * st.reveal;
        ctx.strokeStyle = 'rgba(255,60,70,0.6)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 40, 640); ctx.lineTo(x + 40, 260); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x - 40, 640); ctx.lineTo(x + 40, 260); ctx.stroke();
      }
      M.drawPrompt(ctx, prompt, 640, 680, t, { t0: 0.55, hz: 1.2 });
      ctx.restore();
    },
  };
}
