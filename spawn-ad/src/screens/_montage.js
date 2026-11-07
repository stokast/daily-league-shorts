// Shared helpers for the 16 montage title screens (seen small, ~220-480 px wide, for well under a second).
// Everything is drawn in 1280x720 design units: contexts are pre-scaled by s = w / 1280.
import * as K from './kit.js';

export const DW = 1280, DH = 720;

/** Offscreen sprite drawn in design units: draw(ctx, wD, hD) with ctx already scaled by s. */
export function sprite(wD, hD, s, draw) {
  const c = K.makeCanvas(wD * s, hD * s);
  const x = c.getContext('2d');
  x.scale(s, s);
  draw(x, wD, hD);
  c.wD = wD; c.hD = hD;
  warm(c);
  return c;
}

/** Draw a sprite made by sprite() into a design-unit context, anchored at (ax, ay) of its box. */
export function put(ctx, c, x, y, ax = 0.5, ay = 0.5) {
  ctx.drawImage(c, x - c.wD * ax, y - c.hD * ay, c.wD, c.hD);
}

/**
 * Pixel-exact blit of a sprite at design position (x, y) in a context scaled by s: the position is snapped to
 * whole device pixels and the sprite keeps its own pixel size, so the browser copies instead of resampling.
 */
export function blit(ctx, c, x, y, s) {
  ctx.drawImage(c, Math.round(x * s) / s, Math.round(y * s) / s, c.width / s, c.height / s);
}

/** Soft radial glow sprite (radius rD design units). stops: [[0, 'rgba(..)'], [1, 'rgba(..,0)']] */
export function glow(s, rD, stops) {
  return sprite(rD * 2, rD * 2, s, (x) => {
    x.fillStyle = K.radGrad(x, rD, rD, 0, rD, stops);
    x.fillRect(0, 0, rD * 2, rD * 2);
  });
}

/**
 * Logo pre-render. draw(ctx, text) where text(str, x, y, opts) wraps K.logoText and also records the
 * letter faces into a white mask (used for the landing flash and the shine sweep).
 */
export function makeLogo(s, wD, hD, draw) {
  const canvas = K.makeCanvas(wD * s, hD * s), face = K.makeCanvas(wD * s, hD * s);
  const cx = canvas.getContext('2d'), fx = face.getContext('2d');
  cx.scale(s, s); fx.scale(s, s);
  const text = (str, x, y, opts) => {
    const r = K.logoText(cx, str, x, y, opts);
    K.logoText(fx, str, x, y, { font: opts.font, align: opts.align, tracking: opts.tracking, skewX: opts.skewX, fill: '#fff' });
    return r;
  };
  draw(cx, text, fx);
  warm(canvas, face);
  return { canvas, face, wD, hD, tmp: null };
}

/** Logo intro + idle state. Styles: pop, slam, drop, slide, flip, rise, flicker, stamp, swing, zoom, slice. */
export function intro(t, style = 'pop', o = {}) {
  const t0 = o.t0 ?? 0.04, d = o.dur ?? 0.28;
  const p = K.clamp((t - t0) / d);
  const q = t - t0 - d; // time since landing
  let sx = 1, sy = 1, rot = 0, dx = 0, dy = 0, alpha = 1, flash = 0, skew = 0, reveal = 1;
  switch (style) {
    case 'pop': {
      const e = K.easeOutBack(p, o.k ?? 1.7);
      sx = sy = 0.1 + 0.9 * e;
      alpha = K.clamp(p * 4);
      flash = q > 0 ? K.clamp(1 - q / 0.2) * 0.7 : 0;
      break;
    }
    case 'slam': {
      const e = K.easeInCubic(p);
      sx = sy = K.lerp(o.from ?? 2.4, 1, e);
      alpha = K.clamp(p * 3);
      if (q > 0) {
        const k = Math.exp(-q * 16) * Math.sin(q * 46);
        sx = 1 + 0.07 * k; sy = 1 - 0.07 * k;
        flash = K.clamp(1 - q / 0.22);
      }
      break;
    }
    case 'drop': {
      const b = bounceOut(p);
      dy = -(1 - b) * (o.dist ?? 520);
      alpha = K.clamp(p * 6);
      if (q > 0) { const k = Math.exp(-q * 12) * Math.sin(q * 34); sx = 1 + 0.05 * k; sy = 1 - 0.05 * k; }
      break;
    }
    case 'slide': {
      const e = K.easeOutBack(p, o.k ?? 1.2);
      dx = (1 - e) * (o.dist ?? 1500) * (o.dir ?? -1);
      skew = (1 - K.easeOutCubic(p)) * (o.skew ?? 0.45) * -(o.dir ?? -1);
      alpha = K.clamp(p * 5);
      flash = q > 0 ? K.clamp(1 - q / 0.2) * 0.6 : 0;
      break;
    }
    case 'flip': {
      const e = K.easeOutCubic(p);
      sy = Math.cos((1 - e) * Math.PI * 2);
      sx = 0.85 + 0.15 * e;
      dy = -Math.sin(e * Math.PI) * (o.dist ?? 120);
      alpha = K.clamp(p * 5);
      if (q > 0) { const k = Math.exp(-q * 14) * Math.sin(q * 40); sx = 1 + 0.06 * k; sy = 1 - 0.06 * k; }
      break;
    }
    case 'rise': {
      const e = K.easeOutBack(p, 1.4);
      dy = (1 - e) * (o.dist ?? 300);
      alpha = K.clamp(p * 2.5);
      sx = sy = 0.85 + 0.15 * K.easeOutCubic(p);
      break;
    }
    case 'flicker': {
      // neon tube ignition: stutters on, then steady
      const on = p >= 1 || (p > 0.08 && K.hash(Math.floor(t * 40), 77) < 0.25 + p * 0.7);
      alpha = on ? (p >= 1 ? 1 : 0.55 + 0.45 * p) : (p > 0 ? 0.08 : 0);
      sx = sy = 0.97 + 0.03 * K.easeOutCubic(p);
      flash = q > 0 ? K.clamp(1 - q / 0.25) * 0.5 : 0;
      break;
    }
    case 'stamp': {
      const e = K.easeInCubic(p);
      sx = sy = K.lerp(o.from ?? 1.9, 1, e);
      rot = K.lerp(o.rot0 ?? -0.3, o.rot1 ?? 0, e);
      alpha = K.clamp(p * 3);
      if (q > 0) { const k = Math.exp(-q * 15) * Math.sin(q * 44); sx = 1 + 0.05 * k; sy = 1 - 0.05 * k; flash = K.clamp(1 - q / 0.2) * 0.8; }
      break;
    }
    case 'swing': {
      dy = -(1 - K.easeOutCubic(p)) * (o.dist ?? 380);
      alpha = K.clamp(p * 5);
      const a0 = o.rot0 ?? 0.22;
      rot = p < 1 ? a0 * (1 - p) : a0 * 0.35 * Math.exp(-q * 3.2) * Math.sin(q * 9 + Math.PI / 2) * 0.6;
      break;
    }
    case 'zoom': {
      const e = K.easeOutBack(p, o.k ?? 3);
      sx = sy = 0.05 + 0.95 * e;
      rot = (1 - K.easeOutCubic(p)) * (o.rot0 ?? -0.5);
      alpha = K.clamp(p * 4);
      flash = q > 0 ? K.clamp(1 - q / 0.2) * 0.8 : 0;
      break;
    }
    case 'slice': {
      reveal = K.easeOutCubic(p);
      alpha = 1;
      flash = q > 0 ? K.clamp(1 - q / 0.25) * 0.7 : 0;
      break;
    }
    default: break;
  }
  return { p, q, sx, sy, rot, dx, dy, alpha, flash, skew, reveal };
}

export function bounceOut(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** Deterministic shake offset [dx, dy] for t in [t0, t0 + dur]. */
export function shake(t, t0, dur, amp, seed = 1) {
  const q = (t - t0) / dur;
  if (q < 0 || q > 1) return [0, 0];
  const a = amp * (1 - q) * (1 - q), f = Math.floor(t * 60);
  return [(K.hash(f, seed) - 0.5) * 2 * a, (K.hash(f, seed + 7) - 0.5) * 2 * a];
}

/**
 * Draw a logo made by makeLogo centred at (x, y) with an intro state from intro().
 * o: { ax, ay (anchor 0..1, default centre), bob [amp, hz], breathe [amp, hz], tilt [rad, hz], shine (0..1 sweep progress), shineOpts }
 */
export function drawLogo(ctx, L, x, y, st, t, o = {}) {
  if (st.alpha <= 0) return;
  const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
  let bob = 0, br = 1, tilt = 0;
  if (o.bob) bob = Math.sin(t * K.TAU * o.bob[1] + (o.bob[2] || 0)) * o.bob[0];
  if (o.breathe) br = 1 + Math.sin(t * K.TAU * o.breathe[1]) * o.breathe[0];
  if (o.tilt) tilt = Math.sin(t * K.TAU * o.tilt[1]) * o.tilt[0];
  ctx.save();
  ctx.translate(x + st.dx, y + st.dy + bob);
  if (st.rot || tilt) ctx.rotate(st.rot + tilt);
  if (st.skew) ctx.transform(1, 0, -st.skew, 1, 0, 0);
  ctx.scale(st.sx * br, st.sy * br);
  ctx.globalAlpha = st.alpha;
  const x0 = -L.wD * ax, y0 = -L.hD * ay;
  if (st.reveal < 1) {
    ctx.beginPath();
    ctx.rect(x0, y0, L.wD * st.reveal, L.hD);
    ctx.clip();
  }
  ctx.drawImage(L.canvas, x0, y0, L.wD, L.hD);
  if (st.flash > 0) {
    ctx.globalAlpha = st.flash * st.alpha;
    ctx.drawImage(L.face, x0, y0, L.wD, L.hD);
  }
  if (o.shine != null && o.shine > 0 && o.shine < 1) {
    const span = shineLayer(L, o.shine, o.shineOpts);
    if (span) {
      ctx.globalAlpha = st.alpha;
      const W = L.tmp.width, H = L.tmp.height, k = L.wD / W;
      ctx.drawImage(L.tmp, span[0], 0, span[1] - span[0], H, x0 + span[0] * k, y0, (span[1] - span[0]) * k, L.hD);
    }
  }
  ctx.restore();
}

/** Builds the shine overlay (a slanted light band masked to the letter faces) into L.tmp; returns the
 *  pixel x-range [x0, x1) that holds the band so only that strip is processed and drawn. */
function shineLayer(L, p, o = {}) {
  const { band = 0.075, slope = 0.5, color = '255,255,255', alpha = 0.85 } = o;
  if (!L.tmp) L.tmp = K.makeCanvas(L.canvas.width, L.canvas.height);
  const tc = L.tmp.getContext('2d');
  const W = L.tmp.width, H = L.tmp.height;
  const xc = (-0.15 + 1.3 * p) * W, bw = band * W, yc = H / 2;
  // the band (perpendicular to (1, slope)) spans x = xc +- (bw*(1+slope^2) + slope*H/2) over the canvas height
  const reach = bw * (1 + slope * slope) + slope * H / 2 + 2;
  const x0 = Math.max(0, Math.floor(xc - reach)), x1 = Math.min(W, Math.ceil(xc + reach));
  if (x1 <= x0) return null;
  tc.globalCompositeOperation = 'source-over';
  tc.clearRect(x0, 0, x1 - x0, H);
  tc.drawImage(L.face, x0, 0, x1 - x0, H, x0, 0, x1 - x0, H);
  tc.globalCompositeOperation = 'source-in';
  tc.fillStyle = K.linGrad(tc, xc - bw, yc - bw * slope, xc + bw, yc + bw * slope,
    [[0, `rgba(${color},0)`], [0.5, `rgba(${color},${alpha})`], [1, `rgba(${color},0)`]]);
  tc.fillRect(x0, 0, x1 - x0, H);
  tc.globalCompositeOperation = 'source-over';
  return [x0, x1];
}

/** Draw each canvas once with a transform so first-use costs land in create(), not in the first fg frames. */
export function warm(...canvases) {
  const c = K.makeCanvas(4, 4), x = c.getContext('2d');
  x.setTransform(0.5, 0.1, -0.1, 0.5, 1, 1);
  for (const cv of canvases) if (cv) x.drawImage(cv, 0, 0, 4, 4);
  x.getImageData(0, 0, 1, 1);
}

/** Sweep progress 0..1 for a shine starting at `start`, lasting `dur`, repeating every `every` s. */
export function sweep(t, start = 0.55, dur = 0.5, every = 4) {
  if (t < start) return 0;
  const u = (t - start) % every;
  return u < dur ? u / dur : 0;
}

/**
 * UI prompt (e.g. PRESS START) pre-rendered. o: { font, px, fill, stroke, strokeW, tracking, plate (fn(ctx, w, h)), padX, padY }
 * Returns a sprite; draw it with drawPrompt.
 */
export function makePrompt(s, text, o = {}) {
  const px = o.px ?? 30, tracking = o.tracking ?? 0.12, family = o.font ?? 'Press Start 2P', weight = o.weight ?? 400;
  const m = K.makeCanvas(10, 10).getContext('2d');
  m.font = K.font(weight, px, family);
  const tw = [...text].reduce((a, ch) => a + m.measureText(ch).width, 0) + tracking * px * (text.length - 1);
  const padX = o.padX ?? 26, padY = o.padY ?? 16, sw = o.strokeW ?? 0;
  const wD = tw + padX * 2 + sw * 2, hD = px * 1.25 + padY * 2 + sw * 2;
  return sprite(wD, hD, s, (x) => {
    if (o.plate) o.plate(x, wD, hD);
    x.font = K.font(weight, px, family);
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    const cy = hD / 2 + (o.dy ?? px * 0.06);
    if (sw) { x.lineWidth = sw * 2; x.strokeStyle = o.stroke ?? '#000'; K.spacedText(x, text, wD / 2, cy, tracking, 'center', 'stroke'); }
    x.fillStyle = o.fill ?? '#fff';
    K.spacedText(x, text, wD / 2, cy, tracking, 'center', 'fill');
  });
}

/** Draw a prompt sprite centred at (x, y): fades in from t0, then blinks (mode 'blink') or pulses ('pulse'). */
export function drawPrompt(ctx, P, x, y, t, o = {}) {
  const t0 = o.t0 ?? 0.5;
  const a = K.easeOutCubic((t - t0) / 0.3);
  if (a <= 0) return;
  let v = 1;
  if ((o.mode ?? 'blink') === 'blink') v = t < t0 + 0.6 || K.blinkOn(t - t0, o.hz ?? 1.3, o.duty ?? 0.68) ? 1 : 0.12;
  else v = 0.6 + 0.4 * Math.cos((t - t0) * K.TAU * (o.hz ?? 0.8));
  ctx.save();
  ctx.globalAlpha = a * v;
  const sc = 0.92 + 0.08 * a;
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.drawImage(P, -P.wD / 2, -P.hD / 2, P.wD, P.hD);
  ctx.restore();
}

/** Smooth undulating silhouette: y = base + sum(a * sin(f * x + ph)), filled down to `bottom`. */
export function wavePath(ctx, x0, x1, base, terms, step = 8, bottom = DH + 20) {
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + step; x += step) {
    let y = base;
    for (const [a, f, ph] of terms) y += a * Math.sin(f * x + ph);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(x1 + step, bottom);
  ctx.closePath();
}
export function waveY(x, base, terms) {
  let y = base;
  for (const [a, f, ph] of terms) y += a * Math.sin(f * x + ph);
  return y;
}

/** Puffy cloud sprite from circles: puffs [[x, y, r], ...] in a wD x hD box. */
export function cloud(s, wD, hD, puffs, top = '#ffffff', bottom = '#dfe8f5', rim = null) {
  return sprite(wD, hD, s, (x) => {
    x.beginPath();
    for (const [px, py, r] of puffs) { x.moveTo(px + r, py); x.arc(px, py, r, 0, K.TAU); }
    x.fillStyle = K.linGrad(x, 0, 0, 0, hD, [[0.2, top], [1, bottom]]);
    x.fill();
    if (rim) {
      x.save();
      x.clip();
      x.globalCompositeOperation = 'source-atop';
      for (const [px, py, r] of puffs) {
        x.fillStyle = rim;
        x.beginPath(); x.arc(px - r * 0.18, py - r * 0.22, r * 0.78, 0, K.TAU); x.fill();
      }
      x.restore();
    }
  });
}

/** Jagged burst polygon (comic impact) centred at (cx, cy). */
export function burstPath(ctx, cx, cy, rIn, rOut, n, seed = 3, rot = 0) {
  const r = K.rng(seed);
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * K.TAU;
    const rr = i % 2 ? rIn * (0.85 + r() * 0.3) : rOut * (0.8 + r() * 0.4);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Seeded particle field: n items with fields a..f in [0,1). */
export function field(n, seed) {
  const r = K.rng(seed);
  return Array.from({ length: n }, () => ({ a: r(), b: r(), c: r(), d: r(), e: r(), f: r() }));
}

/** Wrap x into [lo, hi). */
export const wrap = (x, lo, hi) => lo + ((((x - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));

/** Polygon from a flat list of points [x0, y0, x1, y1, ...]. */
export function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

/** Finish a bg in pixel space: grain + vignette (call outside the scaled block). */
export function finish(ctx, w, h, { grain = 0.05, vignette = 0.45, seed = 5, vColor = '0,0,0' } = {}) {
  if (vignette) K.vignette(ctx, w, h, vignette, vColor);
  if (grain) K.grain(ctx, w, h, grain, seed);
}
