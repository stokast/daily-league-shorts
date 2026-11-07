// NEON PULSE: rhythm. Dark stage, neon arcs and equalizer bars pulsing on the beat; Monoton + Audiowide neon logo.
import * as K from './kit.js';
import * as M from './_montage.js';

export const meta = { id: 'rhythm', title: 'NEON PULSE', word: 'rhythm', aspect: 16 / 9 };

const BPM = 128, BEAT = 60 / BPM;
const MAG = '255,60,200', CYA = '40,230,255';
const HZN = 470;

function neonText(c, str, x, y, font, rgb, core, tracking = 0) {
  c.save();
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const draw = (fill) => { c.fillStyle = fill; if (tracking) K.spacedText(c, str, x, y, tracking); else c.fillText(str, x, y); };
  c.shadowColor = `rgba(${rgb},1)`;
  c.shadowBlur = 46; draw(`rgba(${rgb},0.9)`);
  c.shadowBlur = 18; draw(`rgba(${rgb},1)`);
  c.shadowBlur = 0;
  draw(core);
  c.restore();
}

export function create(w, h) {
  const s = w / 1280;
  // logo: built by hand (neon glow pre-rendered); face mask = the cores
  const L = M.makeLogo(s, 1240, 420, (c, text, fx) => {
    neonText(c, 'NEON', 620, 196, K.font(400, 214, 'Monoton'), MAG, '#ffe3f8', 0.02);
    neonText(c, 'PULSE', 620, 356, K.font(400, 156, 'Audiowide'), CYA, '#e6fdff', 0.1);
    for (const [str, y, f, tr] of [['NEON', 196, K.font(400, 214, 'Monoton'), 0.02], ['PULSE', 356, K.font(400, 156, 'Audiowide'), 0.1]]) {
      fx.font = f; fx.textAlign = 'center'; fx.fillStyle = '#fff'; K.spacedText(fx, str, 620, y, tr);
    }
    // heartbeat line between the words
    c.save();
    c.shadowColor = `rgba(${CYA},1)`; c.shadowBlur = 16;
    c.strokeStyle = '#bff8ff'; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    M.poly(c, [150, 232, 420, 232, 450, 206, 480, 260, 510, 222, 530, 232, 710, 232, 740, 206, 770, 260, 800, 222, 820, 232, 1090, 232], false);
    c.stroke();
    c.restore();
  });
  const prompt = M.makePrompt(s, 'PRESS START', { font: 'Audiowide', px: 30, fill: '#9ff6ff', tracking: 0.3, padY: 10 });
  const glowM = M.glow(s, 60, [[0, `rgba(${MAG},0.9)`], [1, `rgba(${MAG},0)`]]);
  const glowC = M.glow(s, 60, [[0, `rgba(${CYA},0.9)`], [1, `rgba(${CYA},0)`]]);
  const NB = 30, BW = 30, GAP = 12;
  let barGrad = null;
  const beatEnv = (t) => Math.exp(-((t % BEAT) / BEAT) * 5);

  return {
    bg(ctx) {
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, 720, [[0, '#05010c'], [0.6, '#1a0730'], [1, '#07020f']]);
      ctx.fillRect(0, 0, 1280, 720);
      // stage light cones from a truss
      ctx.fillStyle = '#1c1530'; ctx.fillRect(0, 26, 1280, 14);
      for (let i = 0; i < 7; i++) {
        const x = 100 + i * 180, rgb = i % 2 ? CYA : MAG;
        ctx.fillStyle = K.linGrad(ctx, 0, 40, 0, 600, [[0, `rgba(${rgb},0.22)`], [1, `rgba(${rgb},0)`]]);
        M.poly(ctx, [x - 14, 40, x + 14, 40, x + 120 + (i - 3) * 30, 600, x - 120 + (i - 3) * 30, 600]); ctx.fill();
        ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(x - 12, 38, 24, 8);
      }
      // horizon glow
      ctx.fillStyle = K.radGrad(ctx, 640, HZN, 10, 700, [[0, `rgba(${MAG},0.45)`], [0.4, 'rgba(120,30,200,0.18)'], [1, 'rgba(40,0,80,0)']]);
      ctx.fillRect(0, 0, 1280, 720);
      // floor grid (radial lines static; horizontal lines scroll in fg)
      ctx.fillStyle = '#0a0216'; ctx.fillRect(0, HZN, 1280, 720 - HZN);
      ctx.strokeStyle = `rgba(${MAG},0.55)`; ctx.lineWidth = 2;
      for (let i = -24; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(640 + i * 14, HZN); ctx.lineTo(640 + i * 120, 720); ctx.stroke(); }
      ctx.fillStyle = `rgba(${MAG},0.9)`; ctx.fillRect(0, HZN - 1, 1280, 3);
      ctx.restore();
      M.finish(ctx, w, h, { grain: 0.05, vignette: 0.55 });
    },
    fg(ctx, t) {
      ctx.save(); ctx.scale(s, s);
      const env = beatEnv(t);
      // scrolling grid lines
      ctx.strokeStyle = `rgba(${MAG},0.6)`; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const u = ((i + (t * 1.6) % 1) / 10);
        const y = HZN + Math.pow(u, 2.2) * (720 - HZN);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
      }
      // neon arcs behind the logo, rippling outward on each beat
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const r = 230 + i * 62 + env * 10;
        const a = 0.25 + 0.75 * Math.exp(-Math.abs(((t / BEAT) % 1) * 5 - i) * 0.9);
        const rgb = i % 2 ? CYA : MAG;
        ctx.strokeStyle = `rgba(${rgb},${(0.22 * a).toFixed(3)})`; ctx.lineWidth = 22;
        ctx.beginPath(); ctx.arc(640, HZN, r, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
        ctx.strokeStyle = `rgba(${rgb},${(0.95 * a).toFixed(3)})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(640, HZN, r, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
      }
      // equalizer bars (mirrored from the centre), bottom of frame
      if (!barGrad) barGrad = K.linGrad(ctx, 0, 520, 0, 712, [[0, `rgb(${CYA})`], [0.5, '#a64dff'], [1, `rgb(${MAG})`]]);
      ctx.fillStyle = barGrad;
      const x0 = 640 - (NB * (BW + GAP)) / 2;
      for (let i = 0; i < NB; i++) {
        const k = Math.abs(i - (NB - 1) / 2);
        const f = 0.25 + 0.75 * Math.abs(Math.sin(t * (3.1 + (k % 5) * 0.9) + k * 1.7)) * (0.55 + 0.45 * env) * (1 - k / NB * 0.5);
        const hh = 18 + f * 170;
        ctx.fillRect(x0 + i * (BW + GAP), 712 - hh, BW, hh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < NB; i++) {
        const k = Math.abs(i - (NB - 1) / 2);
        const f = 0.25 + 0.75 * Math.abs(Math.sin(t * (3.1 + (k % 5) * 0.9) + k * 1.7)) * (0.55 + 0.45 * env) * (1 - k / NB * 0.5);
        ctx.fillRect(x0 + i * (BW + GAP), 712 - (18 + f * 170) - 6, BW, 4);
      }
      // beat flashes at the sides
      ctx.globalAlpha = env * 0.8;
      M.put(ctx, glowM, 120, 420); M.put(ctx, glowC, 1160, 420);
      ctx.globalAlpha = 1;
      // logo: flickers on, then thumps on the beat
      const st = M.intro(t, 'flicker', { t0: 0.03, dur: 0.3 });
      if (st.p >= 1) { st.sx *= 1 + 0.025 * env; st.sy *= 1 + 0.025 * env; }
      M.drawLogo(ctx, L, 640, 248, st, t, { shine: M.sweep(t, 0.7, 0.4, 4.6), shineOpts: { alpha: 0.6 } });
      if (t > 0.5 && ((t / BEAT) % 2) < 1.4) M.drawPrompt(ctx, prompt, 640, 474, t, { t0: 0.5, mode: 'pulse', hz: BPM / 60 / 2 });
      ctx.restore();
    },
  };
}
