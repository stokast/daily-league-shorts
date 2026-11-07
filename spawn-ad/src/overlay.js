// The 2D layer: everything typed. Drawn on a full-frame canvas and composited by the final shader.
import * as THREE from 'three';
import {
  OPEN, PROMPTS, MONTAGE, MONTAGE_PREFIX, MONTAGE_SUFFIX, MONTAGE_START, CLIMAX, WORLD, OUT, END, IN,
} from './timeline.js';
import { clamp, easeOutCubic, easeOutBack, easeInCubic, smoothstep, lerp } from './util.js';

const PEACH = '#ffd9a0';
const PIXEL = '"Geist Pixel"';

// Spawn's logo mark, from the site's inline SVG (19 x 22 cells).
const MARK_WHITE = [
  [4, 4, 2], [2, 5, 4], [1, 6, 5], [1, 7, 5], [0, 8, 6], [0, 9, 6], [0, 10, 6], [9, 10, 2], [0, 11, 6], [9, 11, 4],
  [1, 12, 5], [9, 12, 5], [1, 13, 5], [9, 13, 5], [2, 14, 4], [9, 14, 6], [4, 15, 2], [9, 15, 6], [9, 16, 6],
  [9, 17, 6], [9, 18, 5], [9, 19, 5], [9, 20, 4], [9, 21, 2],
];
const MARK_SPARK = [[14, 0, 1], [14, 1, 1], [13, 2, 3], [12, 3, 5], [10, 4, 9], [12, 5, 5], [13, 6, 3], [14, 7, 1], [14, 8, 1]];

const count = (keys, t) => { let n = 0; while (n < keys.length && keys[n] <= t) n++; return n; };
const lastKeyBefore = (keys, t) => { const n = count(keys, t); return n ? keys[n - 1] : -1e9; };

/** x offset that glides to each new target (deterministic: replays the key history). */
function glide(keys, targets, t, tau = 0.07) {
  let x = targets[0], tPrev = keys.length ? keys[0] : 0;
  for (let i = 0; i < keys.length && keys[i] <= t; i++) {
    const target = targets[i + 1];
    const until = Math.min(t, keys[i + 1] ?? Infinity);
    x = target + (x - target) * Math.exp(-(until - keys[i]) / tau);
    tPrev = keys[i];
  }
  return x;
}

export class Overlay {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.s = W / 1080; // layout designed for 1080 wide
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace; // raw sRGB values, composited in sRGB by the shader
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.lastKey = null;
    this.barAnchor = { x: W / 2, y: 1356 * this.s };
    this.streaks = [];
    this._measure = {};
  }

  font(px) { return `${px * this.s}px ${PIXEL}`; }
  width(text, px) {
    const k = px + '|' + text;
    if (!(k in this._measure)) { this.ctx.font = this.font(px); this._measure[k] = this.ctx.measureText(text).width; }
    return this._measure[k];
  }

  /** Draw the overlay for time t. Returns true if the canvas changed. */
  draw(t) {
    const key = this.stateKey(t);
    if (key === this.lastKey) return false;
    this.lastKey = key;
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    if (t < IN.approach[1]) this.drawOpening(t);
    if (t >= WORLD.barIn - 0.05 && t < OUT.flash + 0.05) this.drawBar(t);
    if (t >= END.cursorAt - 0.02) this.drawEnd(t);
    return true;
  }

  // Quantized description of what's on screen; identical keys mean identical pixels.
  stateKey(t) {
    if (t < OPEN.enter + 0.6) {
      const n = count(OPEN.keys, t);
      return `o|${n}|${this.openCursorOn(t)}|${t < OPEN.keys[0] ? 0 : Math.round(t * 60)}|${t > OPEN.enter ? Math.round(t * 60) : 0}`;
    }
    if (t >= WORLD.barIn - 0.05 && t < OUT.flash + 0.05) return `b|${Math.round(t * 120)}`; // animated: redraw
    if (t >= END.cursorAt - 0.02) return `e|${Math.round(t * 120)}`;
    return 'blank';
  }

  // ---------------------------------------------------------------- opening
  openCursorOn(t) {
    if (t < OPEN.keys[0]) return OPEN.blink.some(([a, b]) => t >= a && t < b);
    if (t < OPEN.enter + 0.02) return true;
    return false;
  }

  /** Centred typing line with a glide, used by the opening and the end card. */
  centeredLine(text, keys, t, px, y) {
    const n = count(keys, t);
    const cw = 0.42 * px * this.s, gap = 0.09 * px * this.s;
    const widths = [];
    for (let i = 0; i <= text.length; i++) widths.push(this.width(text.slice(0, i), px));
    const targets = widths.map((w) => this.W / 2 - (w + gap + cw) / 2);
    const x0 = glide(keys, targets, t);
    return { n, x0, wText: widths[n], cw, gap, y, px };
  }

  drawCursor(x, y, px, alpha = 1, scale = 1) {
    const { ctx, s } = this;
    const cw = 0.42 * px * s, ch = 0.95 * px * s;
    const top = y - 0.78 * px * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur = 18 * s;
    ctx.fillStyle = '#fff';
    const cx = x + cw / 2, cy = top + ch / 2;
    ctx.fillRect(cx - (cw * scale) / 2, cy - (ch * scale) / 2, cw * scale, ch * scale);
    ctx.restore();
  }

  drawOpening(t) {
    const { ctx, s, W, H } = this;
    const px = 76;
    const y = H / 2 + 0.3 * px * s;
    const L = this.centeredLine(OPEN.text, OPEN.keys, t, px, y);
    // after enter the final shader swirls this layer into the centre point
    const fadeOut = 1 - smoothstep(IN.suck[1] - 0.06, IN.suck[1] + 0.02, t);
    if (fadeOut <= 0) return;
    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.font = this.font(px);
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = 16 * s;
    ctx.fillStyle = '#fff';
    ctx.fillText(OPEN.text.slice(0, L.n), L.x0, y);
    ctx.restore();
    if (this.openCursorOn(t)) this.drawCursor(L.x0 + L.wText + L.gap, y, px, fadeOut);
  }

  // ---------------------------------------------------------------- chat bar
  barLayout(lines) {
    const s = this.s;
    const w = 940 * s, lineH = 54 * s;
    const h = (58 + lines * 50) * s;
    const x = (this.W - w) / 2, bottom = 1418 * s;
    return { x, y: bottom - h, w, h, lineH, pad: 92 * s, px: 38 };
  }

  wrap(text, px, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (this.width(next, px) > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    lines.push(cur);
    return lines;
  }

  drawBar(t) {
    const { ctx, s } = this;
    const appear = easeOutCubic((t - WORLD.barIn) / 0.4);
    const gone = smoothstep(OUT.vortex[0], OUT.vortex[0] + 0.22, t);
    const alpha = appear * (1 - gone);
    if (alpha <= 0.001) return;

    // what's in the bar right now
    let mode = 'idle', prompt = null, typed = '', full = '', sentAt = null, keys = null;
    for (const p of PROMPTS) {
      if (t >= p.keys[0] - 0.02 && t < p.enter + 0.3) { prompt = p; break; }
    }
    if (prompt) {
      mode = 'prompt'; full = prompt.text; keys = prompt.keys;
      typed = full.slice(0, count(keys, t));
      if (t >= prompt.enter) sentAt = prompt.enter;
    } else if (t >= CLIMAX.keys[0] - 0.02) {
      mode = 'climax'; full = CLIMAX.text; keys = CLIMAX.keys;
      typed = full.slice(0, count(keys, t));
      if (t >= CLIMAX.enter) sentAt = CLIMAX.enter;
    } else if (t >= MONTAGE_START) {
      mode = 'montage';
    }

    // bar geometry (grows to two lines for long prompts)
    const L0 = this.barLayout(1);
    const maxW = L0.w - L0.pad - 110 * s;
    let lines = [''];
    if (mode === 'prompt' || mode === 'climax') lines = this.wrap(full, L0.px, maxW).length > 1 ? this.wrap(typed || ' ', L0.px, maxW) : [typed];
    const fullLines = (mode === 'prompt' || mode === 'climax') ? this.wrap(full, L0.px, maxW).length : 1;
    // grow smoothly when the text wraps
    const wantLines = Math.max(1, Math.min(fullLines, lines.length));
    let grow = wantLines - 1;
    if (mode === 'prompt' && fullLines > 1) {
      const wrapAt = keys[this.wrap(full, L0.px, maxW)[0].length + 1] ?? 0;
      grow = easeOutCubic((t - wrapAt + 0.02) / 0.12);
      if (sentAt) grow *= 1 - easeOutCubic((t - sentAt - 0.12) / 0.2);
    }
    const L = this.barLayout(1 + grow);
    const slide = (1 - appear) * 40 * s;
    const by = L.y + slide;

    ctx.save();
    ctx.globalAlpha = alpha;
    // glass bar
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40 * s;
    ctx.shadowOffsetY = 10 * s;
    roundRect(ctx, L.x, by, L.w, L.h, 30 * s);
    ctx.fillStyle = 'rgba(9,10,12,0.80)';
    ctx.fill();
    ctx.restore();
    const flash = sentAt ? Math.max(0, 1 - (t - sentAt) / 0.18) : 0;
    roundRect(ctx, L.x + 1 * s, by + 1 * s, L.w - 2 * s, L.h - 2 * s, 29 * s);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + 0.6 * flash})`;
    ctx.stroke();
    // sparkle icon on the left
    this.drawSparkle(L.x + 46 * s, by + 29 * s + 25 * s, 3.1 * s, 1, 0.9);
    // send button on the right
    const bx = L.x + L.w - 76 * s, bS = 54 * s, bY = by + L.h - 29 * s - 25 * s - bS / 2 + 25 * s - 2 * s;
    const ready = (mode === 'prompt' || mode === 'climax') && typed.length > 0;
    roundRect(ctx, bx, bY, bS, bS, 16 * s);
    ctx.fillStyle = flash > 0 ? `rgba(255,217,160,${0.35 + 0.65 * flash})` : ready ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    drawArrow(ctx, bx + bS / 2, bY + bS / 2, 20 * s, ready || flash > 0 ? '#0b0c0e' : 'rgba(255,255,255,0.55)');

    // text
    const tx = L.x + L.pad, ty0 = by + 29 * s + 38 * 0.78 * s + 4 * s;
    ctx.font = this.font(L.px);
    ctx.textBaseline = 'alphabetic';
    if (mode === 'prompt' || mode === 'climax') {
      const sent = sentAt ? easeOutCubic((t - sentAt) / 0.26) : 0;
      ctx.save();
      ctx.globalAlpha = alpha * (1 - sent);
      ctx.translate(0, -sent * 70 * s);
      const tl = this.wrap(typed || '', L.px, maxW);
      const shown = fullLines > 1 ? tl : [typed];
      shown.forEach((line, i) => this.drawPromptLine(line, tx, ty0 + i * L.lineH, L.px, mode === 'climax'));
      // cursor at the end of the text while typing
      if (!sentAt) {
        const last = shown[shown.length - 1] || '';
        const typing = t - lastKeyBefore(keys, t) < 0.35;
        if (typing || ((t * 1.9) % 1) < 0.55) {
          this.drawCursor(tx + this.width(last, L.px) + 0.08 * L.px * s, ty0 + (shown.length - 1) * L.lineH, L.px, 1);
        }
      }
      ctx.restore();
      if (sentAt) this.barAnchor = { x: tx + Math.min(this.width(typed, L.px), maxW) / 2, y: ty0 - 14 * s };
    } else if (mode === 'montage') {
      this.drawMontageLine(t, tx, ty0, L.px);
    } else {
      if (((t * 1.9) % 1) < 0.55) this.drawCursor(tx, ty0, L.px, 1);
    }
    ctx.restore();
    this.drawStreaks();
  }

  // a comet from the prompt to where its game is about to appear
  drawStreaks() {
    const { ctx, s } = this;
    for (const st of this.streaks) {
      const x0 = this.barAnchor.x, y0 = this.barAnchor.y;
      const e = easeInCubic(st.u);
      const hx = lerp(x0, st.x1, e), hy = lerp(y0, st.y1, e);
      const tail = Math.max(0, e - 0.45);
      const tx = lerp(x0, st.x1, tail), ty = lerp(y0, st.y1, tail);
      const big = st.kind !== 'montage';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(255,217,160,0)');
      g.addColorStop(1, 'rgba(255,236,210,0.95)');
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineWidth = (big ? 7 : 5) * s;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      const r = (big ? 34 : 24) * s;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
      hg.addColorStop(0, 'rgba(255,255,255,1)');
      hg.addColorStop(0.25, 'rgba(255,230,190,0.8)');
      hg.addColorStop(1, 'rgba(255,217,160,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
      ctx.restore();
    }
  }

  drawPromptLine(line, x, y, px, climax) {
    const { ctx, s } = this;
    ctx.fillStyle = '#fff';
    if (climax && line.includes('anything')) {
      const i = line.indexOf('anything');
      ctx.fillText(line.slice(0, i), x, y);
      ctx.save();
      ctx.fillStyle = PEACH;
      ctx.shadowColor = 'rgba(255,217,160,0.8)';
      ctx.shadowBlur = 14 * s;
      ctx.fillText(line.slice(i), x + this.width(line.slice(0, i), px), y);
      ctx.restore();
      return;
    }
    ctx.fillText(line, x, y);
  }

  drawMontageLine(t, x, y, px) {
    const { ctx, s } = this;
    // current and previous word
    let idx = -1;
    for (let i = 0; i < MONTAGE.length; i++) if (t >= MONTAGE[i].swap) idx = i;
    const word = (i) => (i >= 0 ? MONTAGE[i].word || MONTAGE[i].screen : '');
    const cur = word(idx), prev = word(idx - 1);
    const u = idx >= 0 ? easeOutCubic((t - MONTAGE[idx].swap) / 0.09) : 1;
    const preW = this.width(MONTAGE_PREFIX, px);
    const wCur = this.width(cur || '___', px), wPrev = this.width(prev || '___', px);
    const wWord = lerp(wPrev, wCur, u);
    ctx.fillStyle = '#fff';
    ctx.fillText(MONTAGE_PREFIX, x, y);
    // the word flips like a slot reel
    const wx = x + preW;
    const lh = 46 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx - 6 * s, y - 40 * s, Math.max(wCur, wPrev) + 12 * s, 54 * s);
    ctx.clip();
    ctx.fillStyle = PEACH;
    ctx.shadowColor = 'rgba(255,217,160,0.7)';
    ctx.shadowBlur = 12 * s;
    if (idx < 0) ctx.fillText('___', wx, y);
    else {
      if (u < 1 && prev) { ctx.globalAlpha = 1 - u; ctx.fillText(prev, wx, y - u * lh); }
      ctx.globalAlpha = Math.min(1, u * 1.5);
      ctx.fillText(cur, wx, y + (1 - u) * lh);
    }
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.fillText(MONTAGE_SUFFIX, wx + wWord, y);
    this.barAnchor = { x: wx + wCur / 2, y: y - 14 * s };
  }

  drawSparkle(cx, cy, cell, alpha = 1, glow = 0.8, color = PEACH) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (glow > 0) { ctx.shadowColor = `rgba(255,217,160,${glow})`; ctx.shadowBlur = cell * 5; }
    for (const [x, y, w] of MARK_SPARK) {
      ctx.fillRect(cx + (x - 14.5) * cell, cy + (y - 4.5) * cell, w * cell + 0.5, cell + 0.5);
    }
    ctx.restore();
  }

  drawMark(x, y, cell, alpha = 1) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    for (const [cx, cy, w] of MARK_WHITE) ctx.fillRect(x + cx * cell, y + cy * cell, w * cell + 0.4, cell + 0.4);
    ctx.fillStyle = PEACH;
    for (const [cx, cy, w] of MARK_SPARK) ctx.fillRect(x + cx * cell, y + cy * cell, w * cell + 0.4, cell + 0.4);
    ctx.restore();
  }

  // ---------------------------------------------------------------- end card
  drawEnd(t) {
    const { ctx, s, W, H } = this;
    const px = 80;
    const y = H / 2 + 0.3 * px * s;
    // the point the cable shrank into becomes the cursor
    const born = easeOutCubic((t - END.cursorAt) / 0.18);
    const L = this.centeredLine(END.text, END.keys, t, px, y);
    ctx.save();
    ctx.font = this.font(px);
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = 16 * s;
    const typed = END.text.slice(0, L.n);
    const brand = END.text.indexOf('SpawnAI');
    ctx.fillStyle = '#fff';
    ctx.fillText(typed.slice(0, brand), L.x0, y);
    if (typed.length > brand) {
      // "SpawnAI": white while typing, a peach sheen sweeps through when the sparkle appears
      const bx = L.x0 + this.width(END.text.slice(0, brand), px);
      const sweep = (t - END.sparkle) / 0.7;
      if (sweep > 0 && sweep < 1.4) {
        const bw = this.width('SpawnAI', px);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        const c = clamp(sweep * 1.2 - 0.1, 0, 1);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(clamp(c - 0.15, 0, 1), '#ffffff');
        g.addColorStop(c, PEACH);
        g.addColorStop(clamp(c + 0.15, 0, 1), '#ffffff');
        g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
      }
      ctx.fillText(typed.slice(brand), bx, y);
    }
    ctx.restore();

    const cx = L.x0 + L.wText + L.gap;
    const morph = (t - END.sparkle) / 0.32;
    if (morph < 0) {
      const typing = t >= END.keys[0] - 0.02;
      const on = typing ? true : (((t - END.cursorAt) * 1.9) % 1) < 0.55;
      if (on) this.drawCursor(cx, y, px, 1, 0.3 + 0.7 * born);
    } else {
      // cursor squashes, then Spawn's sparkle pops out of it
      const cw = 0.42 * px * s;
      const cyMid = y - 0.78 * px * s + 0.95 * px * s / 2;
      if (morph < 0.35) this.drawCursor(cx, y, px, 1, 1 - morph / 0.35);
      const pop = easeOutBack(clamp((morph - 0.2) / 0.8), 2.6);
      const tw = 1 + 0.12 * Math.sin((t - END.sparkle) * 5.0) * smoothstep(1, 1.6, morph);
      if (pop > 0) this.drawSparkle(cx + cw / 2 + 4 * s, cyMid, 6.2 * s * pop * tw, 1, 0.9);
    }

    // lockup: logo mark + spawn.co
    const u = easeOutCubic((t - END.url) / 0.6);
    if (u > 0) {
      const cell = 2.7 * s;
      const text = 'spawn.co';
      const fpx = 46;
      ctx.save();
      ctx.font = this.font(fpx);
      const tw = spacedWidth(ctx, text, 0.1 * fpx * s);
      const total = 19 * cell + 16 * s + tw;
      const lx = W / 2 - total / 2;
      const ly = y + 170 * s - (1 - u) * 18 * s;
      this.drawMark(lx, ly - 22 * cell + 4 * s, cell, u);
      ctx.globalAlpha = u * 0.85;
      ctx.fillStyle = '#fff';
      spacedFill(ctx, text, lx + 19 * cell + 16 * s, ly, 0.1 * fpx * s);
      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawArrow(ctx, cx, cy, size, color) {
  // a pixel-ish up arrow
  const u = size / 5;
  ctx.fillStyle = color;
  ctx.fillRect(cx - u / 2 - 0.5, cy - 2 * u, u + 1, 4.5 * u);
  ctx.fillRect(cx - 1.5 * u, cy - 1 * u, u, u);
  ctx.fillRect(cx + 0.5 * u, cy - 1 * u, u, u);
  ctx.fillRect(cx - 2.5 * u, cy, u, u);
  ctx.fillRect(cx + 1.5 * u, cy, u, u);
}
function spacedWidth(ctx, text, gap) {
  return [...text].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (text.length - 1);
}
function spacedFill(ctx, text, x, y, gap) {
  for (const ch of text) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + gap; }
}
