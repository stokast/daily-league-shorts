// Drawing kit for the title screens of the made-up games. Pure Canvas2D, deterministic (seeded),
// shared by every screen module in this folder.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => Math.pow(clamp(t), 3);
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutBack = (t, k = 1.70158) => { t = clamp(t); const c3 = k + 1; return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };

/** Seeded PRNG (mulberry32). rng() -> [0,1). Never use Math.random in a screen. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stateless hash of an integer (or two) -> [0,1). Handy for per-frame flicker that stays deterministic. */
export function hash(i, j = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Offscreen canvas helper (for pre-rendered sprites like logos). */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
export function radGrad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Font string helper: font(700, 64, 'Fredoka') -> '700 64px "Fredoka"' */
export const font = (weight, px, family) => `${weight} ${px}px "${family}"`;

/** Set ctx.font so `text` fits in maxW (starting from px, shrinking). Returns the size used. */
export function fitFont(ctx, text, maxW, px, family, weight = 400, letterSpacing = 0) {
  let size = px;
  for (let i = 0; i < 40; i++) {
    ctx.font = font(weight, size, family);
    const w = ctx.measureText(text).width + letterSpacing * size * Math.max(0, text.length - 1);
    if (w <= maxW) break;
    size *= 0.95;
  }
  return size;
}

/** Text drawn letter by letter with tracking (em units). align: 'left'|'center'|'right'. */
export function spacedText(ctx, text, x, y, tracking = 0.1, align = 'center', mode = 'fill') {
  const px = parseFloat(/(\d+(\.\d+)?)px/.exec(ctx.font)[1]);
  const gap = tracking * px;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const saveAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => {
    if (mode === 'fill' || mode === 'both') ctx.fillText(ch, cx, y);
    if (mode === 'stroke' || mode === 'both') ctx.strokeText(ch, cx, y);
    cx += widths[i] + gap;
  });
  ctx.textAlign = saveAlign;
  return total;
}

/**
 * Game-logo text: extrusion, layered outlines, gradient fill, highlight, glow.
 * opts: { font, align='center', fill (color|gradient fn (ctx, top, bottom) => style),
 *   outlines: [[width, color], ...] outermost first, extrude: { dx, dy, steps, color },
 *   glow: { color, blur }, highlight: { color, height (0..1 of cap) }, tracking (em), skewX }
 */
export function logoText(ctx, text, x, y, opts = {}) {
  const {
    align = 'center', fill = '#fff', outlines = [], extrude = null, glow = null,
    highlight = null, tracking = 0, skewX = 0, shadow = null,
  } = opts;
  ctx.save();
  ctx.font = opts.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const px = parseFloat(/(\d+(\.\d+)?)px/.exec(ctx.font)[1]);
  const m = ctx.measureText(text);
  const gap = tracking * px;
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = tracking ? widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) : m.width;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const asc = m.actualBoundingBoxAscent || px * 0.75;
  const desc = m.actualBoundingBoxDescent || px * 0.05;
  const top = y - asc, bottom = y + desc;
  if (skewX) { ctx.translate(x, y); ctx.transform(1, 0, -skewX, 1, 0, 0); ctx.translate(-x, -y); }

  const pass = (fn) => {
    if (!tracking) { fn(text, x0); return; }
    let cx = x0;
    chars.forEach((ch, i) => { fn(ch, cx); cx += widths[i] + gap; });
  };

  if (glow) {
    ctx.save();
    ctx.shadowColor = glow.color; ctx.shadowBlur = glow.blur;
    ctx.fillStyle = glow.color;
    pass((s, cx) => ctx.fillText(s, cx, y));
    ctx.restore();
  }
  if (shadow) {
    ctx.save();
    ctx.fillStyle = shadow.color;
    const ow = outlines.length ? outlines[0][0] : 0;
    ctx.strokeStyle = shadow.color; ctx.lineWidth = ow;
    pass((s, cx) => { if (ow) ctx.strokeText(s, cx + shadow.dx, y + shadow.dy); ctx.fillText(s, cx + shadow.dx, y + shadow.dy); });
    ctx.restore();
  }
  if (extrude) {
    const { dx, dy, steps, color } = extrude;
    const ow = outlines.length ? outlines[0][0] : 0;
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = ow;
    for (let i = steps; i >= 1; i--) {
      const ox = (dx * i) / steps, oy = (dy * i) / steps;
      pass((s, cx) => { if (ow) ctx.strokeText(s, cx + ox, y + oy); ctx.fillText(s, cx + ox, y + oy); });
    }
  }
  for (const [w, c] of outlines) {
    ctx.lineWidth = w; ctx.strokeStyle = c;
    pass((s, cx) => ctx.strokeText(s, cx, y));
  }
  ctx.fillStyle = typeof fill === 'function' ? fill(ctx, top, bottom) : fill;
  pass((s, cx) => ctx.fillText(s, cx, y));
  if (highlight) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - px, top - px, total + 2 * px, (bottom - top) * (highlight.height ?? 0.45) + px);
    ctx.clip();
    ctx.fillStyle = highlight.color;
    pass((s, cx) => ctx.fillText(s, cx, y));
    ctx.restore();
  }
  ctx.restore();
  return { width: total, top, bottom, ascent: asc, descent: desc };
}

/** Starfield. opts: { n, seed, color, maxR, twinkleT (seconds; omit for static) } */
export function stars(ctx, w, h, opts = {}) {
  const { n = 200, seed = 7, color = '255,255,255', maxR = 1.6, yMax = h, twinkleT = null } = opts;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * yMax, s = Math.pow(r(), 3) * maxR + 0.3, a0 = 0.35 + r() * 0.65, ph = r() * TAU;
    const a = twinkleT == null ? a0 : a0 * (0.6 + 0.4 * Math.sin(twinkleT * (2 + r() * 3) + ph));
    ctx.fillStyle = `rgba(${color},${a.toFixed(3)})`;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}

/** Mountain / skyline silhouette ridge from x=0..w at baseline y, filled down to h. */
export function ridge(ctx, w, h, baseY, amp, fill, seed = 3, opts = {}) {
  const { step = 24, jag = 0.5 } = opts;
  const r = rng(seed);
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = baseY - r() * amp;
  ctx.lineTo(0, y);
  for (let x = step; x <= w + step; x += step * (0.6 + r() * 0.8)) {
    y = clamp(y + (r() - 0.5) * amp * jag * 2, baseY - amp, baseY);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** City skyline silhouette with optional lit windows. */
export function skyline(ctx, w, h, baseY, opts = {}) {
  const { seed = 11, minH = 40, maxH = 200, minW = 30, maxW = 90, fill = '#000', windows = null } = opts;
  const r = rng(seed);
  let x = -10;
  while (x < w + 10) {
    const bw = minW + r() * (maxW - minW), bh = minH + Math.pow(r(), 1.5) * (maxH - minH);
    ctx.fillStyle = fill;
    ctx.fillRect(x, baseY - bh, bw + 1, h - (baseY - bh));
    if (windows) {
      ctx.fillStyle = windows;
      for (let wy = baseY - bh + 8; wy < baseY - 6; wy += 12) {
        for (let wx = x + 6; wx < x + bw - 6; wx += 10) if (r() < 0.25) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    x += bw + r() * 6;
  }
}

/** Sunburst rays from (cx, cy). */
export function rays(ctx, cx, cy, n, len, colorA, colorB, rot = 0) {
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * TAU, a1 = rot + ((i + 0.5) / n) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * len, cy + Math.sin(a0) * len);
    ctx.lineTo(cx + Math.cos(a1) * len, cy + Math.sin(a1) * len);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? colorA : colorB;
    ctx.fill();
  }
}

/**
 * Pixel-art sprite from string rows. Each char maps to a color in `palette` ('.' or ' ' = transparent).
 * Drawn with integer pixel size `px` at (x, y) top-left. flip: mirror horizontally.
 */
export function pixelSprite(ctx, rows, palette, x, y, px, flip = false) {
  const wCells = Math.max(...rows.map((r) => r.length));
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = palette[row[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      const ix = flip ? wCells - 1 - i : i;
      ctx.fillRect(Math.round(x + ix * px), Math.round(y + j * px), Math.ceil(px), Math.ceil(px));
    }
  }
}

/** Film grain / noise overlay (expensive: use in bg only). */
export function grain(ctx, w, h, amount = 0.08, seed = 5) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 255 * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function vignette(ctx, w, h, strength = 0.55, color = '0,0,0') {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function scanlines(ctx, w, h, alpha = 0.12, gap = 4) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += gap) ctx.fillRect(0, y, w, gap / 2);
}

/** True while a blinking element should show (hz full on/off cycles per second, duty 0..1). */
export const blinkOn = (t, hz = 1.6, duty = 0.62) => ((t * hz) % 1) < duty;

/**
 * Standard intro timing helper for a screen: returns { logo, ui } in 0..1.
 * The engine reveals the panel with a pixel dissolve over t = 0..0.35 s, so a logo "slam" that lands
 * around 0.3-0.6 s and UI that settles by ~0.9 s reads well.
 */
export function introPhases(t) {
  return { logo: easeOutBack((t - 0.12) / 0.45, 2.2), ui: easeOutCubic((t - 0.45) / 0.45) };
}
