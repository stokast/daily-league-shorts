// KART CRASH: kart racing. Bright cartoony sunburst, a curving track, karts, checkered flag, confetti.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'kart', title: 'KART CRASH', word: 'kart racing', aspect: 16 / 9 };

const NAVY = '#1d1b4f';

// track centre line (cubic bezier) and half-width in perspective
const P = [[-250, 700], [450, 720], [620, 480], [1450, 438]];
function bez(u) {
  const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}
const halfW = (u) => K.lerp(250, 18, Math.pow(u, 0.8));
function edge(u, side) {
  const [x, y] = bez(u), [x2, y2] = bez(Math.min(1, u + 0.002)), [x1, y1] = bez(Math.max(0, u - 0.002));
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, hw = halfW(u) * side;
  return [x + nx * hw, y + ny * hw * 0.55];
}

function kart(c, body, suit, helmet, num) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(0, -2, 118, 12, 0, 0, K.TAU); c.fill();
  const stroke = (lw = 6) => { c.lineWidth = lw; c.strokeStyle = NAVY; c.stroke(); };
  // spoiler
  c.beginPath(); c.moveTo(-96, -58); c.lineTo(-104, -92); stroke(8);
  K.roundRect(c, -132, -102, 54, 15, 5); c.fillStyle = body; c.fill(); stroke();
  // driver
  K.roundRect(c, -40, -104, 40, 50, 12); c.fillStyle = suit; c.fill(); stroke();
  c.beginPath(); c.arc(-14, -118, 28, 0, K.TAU); c.fillStyle = helmet; c.fill(); stroke();
  K.roundRect(c, -6, -128, 32, 18, 8); c.fillStyle = '#263a6b'; c.fill(); stroke(4);
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(2, -125, 12, 4);
  c.beginPath(); c.moveTo(-26, -138); c.quadraticCurveTo(-14, -146, 0, -140); c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
  c.beginPath(); c.moveTo(4, -70); c.lineTo(24, -90); stroke(8);
  // body
  M.poly(c, [-112, -40, -98, -66, -34, -68, 8, -60, 96, -56, 130, -42, 124, -22, -104, -20]);
  c.fillStyle = K.linGrad(c, 0, -68, 0, -20, [[0, body], [1, body]]); c.fill(); stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  M.poly(c, [-90, -50, 100, -46, 112, -38, -94, -40]); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.18)';
  M.poly(c, [-104, -26, 124, -28, 122, -22, -104, -20]); c.fill();
  c.beginPath(); c.arc(46, -44, 15, 0, K.TAU); c.fillStyle = '#fff'; c.fill(); stroke(4);
  c.fillStyle = NAVY; c.font = K.font(400, 22, 'Luckiest Guy'); c.textAlign = 'center'; c.fillText(num, 46, -36);
  // wheels
  for (const [x, y, r] of [[-64, -30, 31], [70, -27, 27]]) {
    c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.fillStyle = '#20202c'; c.fill(); stroke(5);
    c.beginPath(); c.arc(x, y, r * 0.48, 0, K.TAU); c.fillStyle = '#d4d9e3'; c.fill();
    c.beginPath(); c.arc(x, y, r * 0.18, 0, K.TAU); c.fillStyle = body; c.fill();
  }
  // exhaust
  K.roundRect(c, -126, -42, 20, 10, 4); c.fillStyle = '#9aa3b5'; c.fill(); stroke(4);
}

export function create(w, h) {
  const s = w / 1280;
  const L = M.makeLogo(s, 1240, 400, (c, text) => {
    c.save();
    c.translate(640, 215); c.scale(2.35, 1);
    M.burstPath(c, 0, 0, 120, 178, 14, 5, 0.1);
    c.restore();
    c.lineJoin = 'round';
    c.lineWidth = 12; c.strokeStyle = NAVY; c.stroke();
    c.fillStyle = K.linGrad(c, 0, 40, 0, 390, [[0, '#ff7b1c'], [1, '#ff2d2d']]); c.fill();
    const base = {
      fill: (cc, top, bottom) => K.linGrad(cc, 0, top, 0, bottom, [[0, '#fff7a0'], [0.45, '#ffdf2e'], [1, '#ffa400']]),
      outlines: [[40, NAVY], [20, '#e3241d']],
      extrude: { dx: 9, dy: 16, steps: 16, color: NAVY },
      highlight: { color: 'rgba(255,255,255,0.55)', height: 0.38 },
      skewX: 0.16,
    };
    text('KART', 520, 188, { ...base, font: K.font(400, 196, 'Luckiest Guy') });
    text('CRASH', 680, 360, { ...base, font: K.font(400, 236, 'Luckiest Guy') });
  });
  const karts = [
    M.sprite(300, 190, s, (c) => { c.translate(150, 170); kart(c, '#ff3b30', '#ffcf2e', '#ffffff', '1'); }),
    M.sprite(300, 190, s, (c) => { c.translate(150, 170); kart(c, '#2f7bff', '#2ad38b', '#ffd23f', '7'); }),
    M.sprite(300, 190, s, (c) => { c.translate(150, 170); kart(c, '#24c16a', '#ff7a2f', '#ff4fa3', '3'); }),
  ];
  const prompt = M.makePrompt(s, 'PRESS START', { font: 'Luckiest Guy', px: 42, fill: '#ffffff', stroke: NAVY, strokeW: 6, tracking: 0.08, padY: 8 });
  const conf = M.field(60, 41);
  const CONF = ['#ffd23f', '#ff3b30', '#2f7bff', '#ffffff', '#24c16a', '#ff4fa3'];

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 440, [[0, '#118be0'], [0.7, '#3db5f5'], [1, '#8ad8ff']]);
      ctx.fillRect(0, 0, 1280, 440);
      K.rays(ctx, 640, 230, 22, 1400, 'rgba(255,255,255,0)', 'rgba(255,255,255,0.13)', 0.05);
      // horizon: grandstand + trees
      ctx.fillStyle = '#2a9a4a';
      for (let x = -20; x < 1300; x += 46) { ctx.beginPath(); ctx.arc(x, 432, 30 + (x * 7 % 13), 0, K.TAU); ctx.fill(); }
      ctx.fillStyle = '#e6e9f2'; ctx.fillRect(760, 360, 470, 70);
      ctx.fillStyle = '#ff3b30'; M.poly(ctx, [744, 362, 1246, 362, 1228, 340, 762, 340]); ctx.fill();
      const r = K.rng(4);
      for (let x = 770; x < 1222; x += 9) for (let y = 372; y < 424; y += 10) {
        ctx.fillStyle = CONF[(r() * CONF.length) | 0]; ctx.fillRect(x, y, 5, 6);
      }
      // grass with mowing stripes
      ctx.fillStyle = '#41c249'; ctx.fillRect(0, 432, 1280, 288);
      for (let i = 0; i < 9; i++) {
        const y0 = 432 + Math.pow(i / 9, 1.7) * 300, y1 = 432 + Math.pow((i + 0.5) / 9, 1.7) * 300;
        ctx.fillStyle = '#36b03f'; ctx.fillRect(0, y0, 1280, y1 - y0);
      }
      // track
      const N = 90, outer = [], inner = [];
      for (let i = 0; i <= N; i++) { const u = i / N; outer.push(edge(u, 1)); inner.push(edge(u, -1)); }
      ctx.beginPath();
      outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = N; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath();
      ctx.fillStyle = K.linGrad(ctx, 0, 430, 0, 720, [[0, '#7d8396'], [1, '#575d70']]); ctx.fill();
      // curbs
      for (const side of [outer, inner]) {
        for (let i = 0; i < N; i++) {
          const u = i / N, wdt = K.lerp(26, 3, u);
          ctx.lineWidth = wdt; ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff3b30';
          ctx.beginPath(); ctx.moveTo(side[i][0], side[i][1]); ctx.lineTo(side[i + 1][0], side[i + 1][1]); ctx.stroke();
        }
      }
      // centre dashes
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      for (let i = 2; i < N; i += 4) {
        const a = bez(i / N), b = bez((i + 1.6) / N);
        ctx.lineWidth = K.lerp(10, 1.5, i / N);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // tyre stacks
      for (const [x, y, k] of [[1090, 610, 1], [1200, 590, 0.9], [60, 520, 0.8]]) {
        for (let j = 0; j < 3; j++) {
          const yy = y - j * 24 * k;
          ctx.fillStyle = '#20202c'; ctx.beginPath(); ctx.ellipse(x, yy, 40 * k, 16 * k, 0, 0, K.TAU); ctx.fill();
          ctx.fillStyle = j % 2 ? '#ff3b30' : '#ffffff'; ctx.fillRect(x - 40 * k, yy - 3 * k, 80 * k, 6 * k);
        }
        ctx.fillStyle = '#20202c'; ctx.beginPath(); ctx.ellipse(x, y - 60 * k, 40 * k, 14 * k, 0, 0, K.TAU); ctx.fill();
        ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.ellipse(x, y - 60 * k, 18 * k, 6 * k, 0, 0, K.TAU); ctx.fill();
      }
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.03, vignette: 0.3, vColor: '10,20,80' });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      // waving checkered flag (top left, behind the logo)
      ctx.save();
      ctx.lineWidth = 9; ctx.strokeStyle = '#2b2b3a'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(60, 470); ctx.lineTo(112, 36); ctx.stroke();
      const cols = 8, rows = 5, cw = 30, ch = 28, fx = 112, fy = 40;
      const pt = (i, j) => [fx + i * cw * (1 - 0.04 * Math.sin(t * 5 + i * 0.7)), fy + j * ch + Math.sin(t * 6 - i * 0.75) * i * 2.6];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
        const shade = 0.82 + 0.18 * Math.cos(t * 6 - i * 0.75);
        ctx.fillStyle = (i + j) % 2 ? `rgba(20,20,30,1)` : `rgb(${(255 * shade) | 0},${(255 * shade) | 0},${(255 * shade) | 0})`;
        M.poly(ctx, [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]); ctx.fill();
      }
      ctx.restore();
      // karts jostling on the track
      [[0.78, 0.46, 2], [0.55, 0.72, 1], [0.3, 1.05, 0]].forEach(([u0, sc, k], i) => {
        const u = u0 + 0.012 * Math.sin(t * 0.9 + i * 2.1);
        const [x, y] = bez(u), [x2, y2] = bez(u + 0.01);
        const ang = Math.atan2(y2 - y, x2 - x) * 0.55;
        const jit = Math.sin(t * 38 + i * 3) * 1.6;
        // speed streaks
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++) {
          const len = (60 + 40 * j) * sc, ph = M.wrap(t * 3 + j * 0.37 + i * 0.2, 0, 1);
          ctx.lineWidth = 5 * sc;
          const bx = x - (130 + ph * 60) * sc, by = y - (30 + j * 26) * sc;
          ctx.globalAlpha = 1 - ph;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - len, by + len * Math.tan(-ang) * 0.3); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(x, y + jit); ctx.rotate(ang); ctx.scale(sc, sc);
        ctx.drawImage(karts[k], -150, -170, 300, 190);
        ctx.restore();
      });
      // confetti
      for (let i = 0; i < conf.length; i++) {
        const c = conf[i];
        const y = M.wrap(c.b * 760 + t * (70 + c.c * 90), -20, 740);
        const x = M.wrap(c.a * 1280 + Math.sin(t * 2 + c.d * 6) * 24, 0, 1280);
        const rot = t * (2 + c.e * 5) + c.f * 6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.cos(rot * 1.7), 1);
        ctx.fillStyle = CONF[i % CONF.length]; ctx.fillRect(-7, -4, 14, 8);
        ctx.restore();
      }
      // logo slides in with speed lines
      const st = M.intro(t, 'slide', { t0: 0.03, dur: 0.3, dir: -1, dist: 1500 });
      if (st.p > 0.2 && t < 0.75) {
        const a = K.clamp((0.75 - t) / 0.4);
        ctx.strokeStyle = `rgba(255,255,255,${(0.8 * a).toFixed(3)})`; ctx.lineCap = 'round';
        for (let j = 0; j < 7; j++) {
          const yy = 90 + j * 48, len = 260 + (j * 97) % 200;
          ctx.lineWidth = 8;
          const x1 = 40 + st.dx + (j * 53) % 120;
          ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x1 + len, yy); ctx.stroke();
        }
      }
      const [sx, sy] = M.shake(t, 0.33, 0.25, 10, 3);
      M.drawLogo(ctx, L, 640 + sx, 236 + sy, st, t, { breathe: [0.012, 0.9], shine: M.sweep(t, 0.6, 0.45, 3.8) });
      M.drawPrompt(ctx, prompt, 640, 668, t, { t0: 0.5, hz: 1.6 });
      ctx.restore();
    },
  };
}
