// PUTT PANIC: mini golf. A candy-bright course: windmill with turning blades, flag, pond, palms, and a panicking
// ball teetering on the lip; bouncy two-tone Lilita One logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'golf', title: 'PUTT PANIC', word: 'mini golf', aspect: 16 / 9 };

const PURP = '#2b0f4a';
const HOLE = [372, 612], WM = [950, 566], HUB = [950, 318];

function palm(c, x, y, hgt, lean, flip) {
  c.save(); c.translate(x, y); c.scale(flip, 1);
  c.lineCap = 'round';
  c.strokeStyle = '#8a5a32'; c.lineWidth = 22;
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.4, -hgt * 0.6, lean, -hgt); c.stroke();
  c.strokeStyle = '#6e4423'; c.lineWidth = 3;
  for (let k = 1; k < 9; k++) { const u = k / 9, px = lean * (0.8 * u * u + 0.2 * u), py = -hgt * u; c.beginPath(); c.moveTo(px - 10, py + 4); c.lineTo(px + 10, py - 2); c.stroke(); }
  for (const [a, l] of [[-2.7, 150], [-2.2, 170], [-1.6, 130], [-1.0, 170], [-0.45, 150], [0.15, 120], [-3.2, 120]]) {
    c.save(); c.translate(lean, -hgt); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * 0.5, -36, l, 18); c.quadraticCurveTo(l * 0.5, -8, 0, 0);
    c.fillStyle = '#2fa84f'; c.fill(); c.strokeStyle = '#1b6d33'; c.lineWidth = 4; c.stroke();
    c.restore();
  }
  c.restore();
}

function windmillBody(c) {
  // origin = base centre
  c.lineJoin = 'round';
  M.poly(c, [-92, 0, 92, 0, 56, -228, -56, -228]);
  c.fillStyle = K.linGrad(c, -92, 0, 92, 0, [[0, '#ff7aa6'], [0.6, '#ff4f86'], [1, '#d6336c']]); c.fill();
  c.lineWidth = 7; c.strokeStyle = PURP; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 6;
  for (const y of [-70, -150]) { const k = -y / 228; c.beginPath(); c.moveTo(-92 + 36 * k, y); c.lineTo(92 - 36 * k, y); c.stroke(); }
  M.poly(c, [-76, -228, 76, -228, 0, -318]);
  c.fillStyle = K.linGrad(c, 0, -318, 0, -228, [[0, '#9b5cff'], [1, '#6a2fc0']]); c.fill(); c.lineWidth = 7; c.strokeStyle = PURP; c.stroke();
  // tunnel
  c.fillStyle = '#1a0a2a';
  c.beginPath(); c.moveTo(-40, 0); c.lineTo(-40, -50); c.arc(0, -50, 40, Math.PI, 0); c.lineTo(40, 0); c.closePath(); c.fill();
  c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.stroke();
  // window
  c.fillStyle = '#ffe066'; c.beginPath(); c.arc(0, -180, 18, 0, K.TAU); c.fill(); c.lineWidth = 5; c.strokeStyle = PURP; c.stroke();
}
function blades(c) {
  c.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2);
    M.poly(c, [-8, -20, 8, -20, 10, -186, -44, -186, -44, -40]);
    c.fillStyle = '#fff6fa'; c.fill(); c.lineWidth = 6; c.strokeStyle = PURP; c.stroke();
    c.strokeStyle = '#ff4f86'; c.lineWidth = 4;
    for (let y = -60; y > -186; y -= 30) { c.beginPath(); c.moveTo(-42, y); c.lineTo(6, y); c.stroke(); }
    c.beginPath(); c.moveTo(-18, -30); c.lineTo(-18, -184); c.stroke();
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, 20, 0, K.TAU); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 6; c.strokeStyle = PURP; c.stroke();
}
function ballGuy(c, closed) {
  // the panicking golf ball (origin = centre)
  c.beginPath(); c.arc(0, 0, 40, 0, K.TAU);
  c.fillStyle = K.radGrad(c, -14, -16, 4, 48, [[0, '#ffffff'], [0.7, '#eef0f6'], [1, '#c9cfdf']]); c.fill();
  c.fillStyle = 'rgba(150,160,190,0.45)';
  for (const [x, y] of [[-22, 14], [-8, 24], [8, 26], [22, 16], [-28, 0], [28, 2], [-20, -24], [20, -26], [0, -32]]) { c.beginPath(); c.arc(x, y, 3.5, 0, K.TAU); c.fill(); }
  c.lineWidth = 6; c.strokeStyle = PURP; c.beginPath(); c.arc(0, 0, 40, 0, K.TAU); c.stroke();
  for (const ex of [-13, 13]) {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, -6, 11, 13, 0, 0, K.TAU); c.fill(); c.lineWidth = 3.5; c.stroke();
    if (closed) { c.beginPath(); c.moveTo(ex - 8, -6); c.lineTo(ex + 8, -6); c.stroke(); }
    else { c.fillStyle = PURP; c.beginPath(); c.arc(ex + (ex < 0 ? -3 : 3), -4, 4.5, 0, K.TAU); c.fill(); }
  }
  c.fillStyle = PURP; c.beginPath(); c.ellipse(0, 18, 7, 9, 0, 0, K.TAU); c.fill();
  // sweat drop
  c.fillStyle = '#7fd8ff'; c.beginPath(); c.moveTo(34, -40); c.quadraticCurveTo(44, -24, 36, -18); c.quadraticCurveTo(26, -22, 34, -40); c.fill();
  c.lineWidth = 3; c.stroke();
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 330, (c, text, fx) => {
    const font = K.font(400, 184, 'Lilita One');
    c.font = font;
    const word = 'PUTT PANIC', widths = [...word].map((ch) => c.measureText(ch).width + 6);
    let x = 620 - widths.reduce((a, b) => a + b, 0) / 2;
    const pink = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#ffd2e6'], [0.5, '#ff6aa6'], [1, '#e8236e']]);
    const lime = (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#f2ffb0'], [0.5, '#a6ec3a'], [1, '#4fbf1f']]);
    [...word].forEach((ch, i) => {
      const cx = x + widths[i] / 2;
      x += widths[i];
      if (ch === ' ') return;
      const rot = (i % 2 ? 1 : -1) * 0.065, dy = i % 2 ? -10 : 8;
      for (const ctx2 of [c, fx]) { ctx2.save(); ctx2.translate(cx, 238 + dy); ctx2.rotate(rot); }
      text(ch, 0, 0, {
        font, fill: i < 4 ? pink : lime,
        outlines: [[38, PURP], [16, '#ffffff']], extrude: { dx: 0, dy: 15, steps: 15, color: PURP },
        highlight: { color: 'rgba(255,255,255,0.5)', height: 0.34 },
      });
      for (const ctx2 of [c, fx]) ctx2.restore();
    });
  });
  const bladeS = M.sprite(420, 420, s, (c) => { c.translate(210, 210); blades(c); });
  const ballS = [M.sprite(110, 110, s, (c) => { c.translate(55, 55); ballGuy(c, false); }), M.sprite(110, 110, s, (c) => { c.translate(55, 55); ballGuy(c, true); })];
  const cloudA = M.cloud(s, 260, 110, [[50, 72, 36], [110, 52, 48], [170, 62, 40], [220, 78, 26], [130, 82, 26]], '#ffffff', '#dff3ff');
  const prompt = M.makePrompt(s, 'PRESS START', {
    font: 'Lilita One', px: 34, fill: '#ffffff', stroke: PURP, strokeW: 4, tracking: 0.1, padX: 36, padY: 10,
    plate: (x, pw, ph) => { K.roundRect(x, 3, 3, pw - 6, ph - 6, ph / 2); x.fillStyle = '#4fbf1f'; x.fill(); x.lineWidth = 5; x.strokeStyle = PURP; x.stroke(); },
  });

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 440, [[0, '#1aa6f0'], [1, '#8ee6ff']]);
      ctx.fillRect(0, 0, 1280, 720);
      // hedge + fence
      ctx.fillStyle = '#2f9a4a';
      for (let x = -20; x < 1300; x += 38) { ctx.beginPath(); ctx.arc(x, 418, 30, 0, K.TAU); ctx.fill(); }
      ctx.fillRect(0, 418, 1280, 40);
      ctx.fillStyle = '#ffffff';
      for (let x = 10; x < 1280; x += 34) { M.poly(ctx, [x, 452, x + 16, 452, x + 16, 404, x + 8, 394, x, 404]); ctx.fill(); }
      ctx.fillRect(0, 420, 1280, 8); ctx.fillRect(0, 440, 1280, 8);
      palm(ctx, 70, 470, 330, 40, 1); palm(ctx, 1210, 470, 300, 50, -1);
      // course ground
      ctx.fillStyle = '#3fae46'; ctx.fillRect(0, 452, 1280, 268);
      // the green with a brick rail
      const green = () => {
        ctx.beginPath();
        ctx.moveTo(90, 720); ctx.bezierCurveTo(40, 600, 120, 500, 300, 492);
        ctx.bezierCurveTo(520, 482, 640, 520, 840, 500); ctx.bezierCurveTo(1060, 478, 1240, 520, 1220, 620);
        ctx.bezierCurveTo(1210, 680, 1180, 710, 1160, 720); ctx.closePath();
      };
      green(); ctx.lineWidth = 34; ctx.strokeStyle = PURP; ctx.stroke();
      ctx.lineWidth = 24; ctx.strokeStyle = '#ff6f61'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([18, 10]); ctx.stroke(); ctx.setLineDash([]);
      green(); ctx.fillStyle = K.linGrad(ctx, 0, 480, 0, 720, [[0, '#8be85a'], [1, '#55c63c']]); ctx.fill();
      // mowing stripes on the green
      ctx.save(); green(); ctx.clip();
      for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; M.poly(ctx, [i * 140 - 100, 480, i * 140 - 30, 480, i * 140 + 60, 720, i * 140 - 10, 720]); ctx.fill(); }
      // pond
      ctx.fillStyle = '#16b8d8'; ctx.beginPath(); ctx.ellipse(700, 680, 150, 46, 0, 0, K.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4;
      for (const [x, y, ww] of [[640, 668, 50], [720, 690, 70], [770, 664, 36]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ww, y); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate(WM[0], WM[1]); windmillBody(ctx); ctx.restore();
      // hole
      ctx.fillStyle = '#1a0a2a'; ctx.beginPath(); ctx.ellipse(HOLE[0], HOLE[1], 30, 11, 0, 0, K.TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(HOLE[0] - 3, HOLE[1] - 210, 6, 210);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.03, vignette: 0.28, vColor: '20,10,60' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      M.put(ctx, cloudA, M.wrap(200 + t * 12, -160, 1440), 90);
      M.put(ctx, cloudA, M.wrap(900 + t * 9, -160, 1440), 140);
      // windmill blades turning
      ctx.save(); ctx.translate(HUB[0], HUB[1]); ctx.rotate(t * 1.4); ctx.drawImage(bladeS, -210, -210, 420, 420); ctx.restore();
      // flag
      const fx0 = HOLE[0] + 3, fy0 = HOLE[1] - 210;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        const p = (ii, jj) => [fx0 + ii * 18, fy0 + jj * 26 + Math.sin(t * 7 - ii * 0.9) * ii * 1.8];
        const a = p(i, j), b = p(i + 1, j), c2 = p(i + 1, j + 1), d = p(i, j + 1);
        ctx.fillStyle = (i + j) % 2 ? '#ffd23f' : '#ff3b5c';
        M.poly(ctx, [a[0], a[1], b[0], b[1], c2[0], c2[1], d[0], d[1]]); ctx.fill();
      }
      // the ball teetering on the lip
      const wob = Math.sin(t * 5.2) * 0.5 + Math.sin(t * 13) * 0.12;
      ctx.fillStyle = 'rgba(30,60,20,0.3)'; ctx.beginPath(); ctx.ellipse(HOLE[0] + 44 + wob * 10, HOLE[1] + 6, 34, 9, 0, 0, K.TAU); ctx.fill();
      ctx.save(); ctx.translate(HOLE[0] + 44 + wob * 10, HOLE[1] - 30); ctx.rotate(wob * 0.35);
      const blink = (t % 2.4) < 0.1;
      ctx.drawImage(ballS[blink ? 1 : 0], -55, -55, 110, 110);
      ctx.restore();
      // panic lines
      ctx.strokeStyle = PURP; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const pl = 0.5 + 0.5 * Math.sin(t * 10);
      for (const [dx, dy, a] of [[-40, -78, -0.5], [0, -92, 0], [40, -78, 0.5]]) {
        const x = HOLE[0] + 44 + dx, y = HOLE[1] - 30 + dy;
        ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * 6, y + 6); ctx.lineTo(x + Math.sin(a) * (10 + pl * 6), y - 10 - pl * 6); ctx.stroke();
      }
      // logo: pops in, then shivers in panic every couple of seconds
      const st = M.intro(t, 'pop', { t0: 0.03, dur: 0.3, k: 2.4 });
      const pq = (t - 0.8) % 2.3;
      if (t > 0.8 && pq < 0.4) { st.rot += Math.sin(pq * 70) * 0.02 * (1 - pq / 0.4); st.dx += Math.sin(pq * 90) * 7 * (1 - pq / 0.4); }
      M.drawLogo(ctx, L, 640, 196, st, t, { bob: [3, 0.55], shine: M.sweep(t, 0.6, 0.45, 4.6) });
      M.drawPrompt(ctx, prompt, 1000, 676, t, { t0: 0.55, hz: 1.4 });
      ctx.restore();
    },
  };
}
