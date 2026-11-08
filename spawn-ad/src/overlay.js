// The 2D layer: everything typed. Drawn on a full-frame canvas and composited by the final shader.
import * as THREE from 'three';
import {
  OPEN, PROMPTS, MONTAGE, MONTAGE_PREFIX, MONTAGE_SUFFIX, MONTAGE_START, CLIMAX, WORLD, OUT, END, IN,
} from './timeline.js';
import { clamp, easeOutCubic, easeOutBack, easeInCubic, smoothstep, lerp, hash } from './util.js';
import { riderZ, trailX } from './ride.js';

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
    if (t < IN.handoff) this.drawOpening(t);
    if (t >= WORLD.start && t < OUT.flash + 0.05) { this.drawHUD(t); this.drawStreaks(); }
    if (t >= END.cursorAt - 0.02) this.drawEnd(t);
    return true;
  }

  // Quantized description of what's on screen; identical keys mean identical pixels.
  stateKey(t) {
    if (t < IN.handoff + 0.05) {
      const n = count(OPEN.keys, t);
      return `o|${n}|${this.openCursorOn(t)}|${t < OPEN.keys[0] ? 0 : Math.round(t * 60)}|${t > OPEN.enter ? Math.round(t * 60) : 0}`;
    }
    if (t >= WORLD.start && t < OUT.flash + 0.05) return `w|${Math.round(t * 60)}|${this.streaks.length}`; // HUD + streaks
    if (t >= END.cursorAt - 0.02) return `e|${Math.round(t * 120)}`;
    return 'blank';
  }

  // ---------------------------------------------------------------- opening
  openCursorOn(t) {
    if (t < OPEN.keys[0]) return OPEN.blink.some(([a, b]) => t >= a && t < b);
    return t < IN.handoff;
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
    const { ctx, s } = this;
    if (t >= IN.handoff) return; // from here the 3D tunnel scene owns the letters
    const px = 76;
    const y = this.H / 2 + 0.3 * px * s;
    const L = this.centeredLine(OPEN.text, OPEN.keys, t, px, y);
    // a little kick of light on enter, as the cable opens behind the words
    const kick = t >= IN.open ? Math.exp(-(t - IN.open) * 18) : 0;
    ctx.save();
    ctx.font = this.font(px);
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = `rgba(255,236,210,${0.35 + 0.4 * kick})`;
    ctx.shadowBlur = (16 + 14 * kick) * s;
    ctx.fillStyle = '#fff';
    ctx.fillText(OPEN.text.slice(0, L.n), L.x0, y);
    ctx.restore();
    if (this.openCursorOn(t)) this.drawCursor(L.x0 + L.wText + L.gap, y, px, 1);
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
  // ---------------------------------------------------------------- MMO HUD
  drawHUD(t) {
    const { ctx, s, W } = this;
    const a = smoothstep(WORLD.start + 0.35, WORLD.start + 0.9, t) * (1 - smoothstep(OUT.vortex[0], OUT.vortex[0] + 0.25, t));
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    const y0 = 176 * s;
    // player frame (top left): portrait with Spawn's sparkle, level, name, health and mana
    const px = 44 * s, pr = 46 * s;
    const cx = px + pr, cy = y0 + pr;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12 * s;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,11,14,0.86)';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 4 * s; ctx.strokeStyle = PEACH; ctx.stroke();
    this.drawSparkle(cx, cy, 3.6 * s, 1, 0.7);
    // level badge
    ctx.beginPath(); ctx.arc(px + 8 * s, y0 + 2 * pr - 6 * s, 17 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0c10'; ctx.fill();
    ctx.lineWidth = 2.5 * s; ctx.strokeStyle = PEACH; ctx.stroke();
    ctx.font = this.font(19); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('60', px + 8 * s, y0 + 2 * pr - 5 * s);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const bx = px + 2 * pr + 14 * s, bw = 236 * s;
    ctx.font = this.font(28); ctx.fillStyle = '#fff';
    ctx.fillText('you', bx, y0 + 26 * s);
    const bar = (yy, h, frac, c0, c1) => {
      roundRect(ctx, bx, yy, bw, h, h / 2);
      ctx.fillStyle = 'rgba(10,11,14,0.8)'; ctx.fill();
      ctx.save(); ctx.clip();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g; ctx.fillRect(bx, yy, bw * frac, h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx, yy, bw * frac, h * 0.4);
      ctx.restore();
      ctx.lineWidth = 2 * s; ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, bx, yy, bw, h, h / 2); ctx.stroke();
    };
    bar(y0 + 40 * s, 18 * s, 1.0, '#47d76a', '#2a9d4a');
    bar(y0 + 66 * s, 12 * s, 0.82 + 0.1 * Math.sin(t * 0.7), '#22d3ee', '#1d96a0');

    // minimap (top right): road, houses, the player arrow, the games as markers
    const mr = 80 * s, mx = W - 44 * s - mr, my = y0 + mr;
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28,46,36,0.88)'; ctx.fill();
    ctx.clip();
    const scale = 2.3 * s; // px per metre
    const rz = riderZ(t);
    // houses either side of the road (a fixed pseudo-random layout that scrolls past)
    ctx.fillStyle = 'rgba(214,190,150,0.75)';
    for (let k = 0; k < 40; k++) {
      const z = 14 - k * 4.1;
      const side = k % 2 ? 1 : -1;
      const hx = trailX(z) + side * (6 + hash(k, 1) * 3), w = (3.5 + hash(k, 2) * 2) * scale, d = (3 + hash(k, 3) * 2) * scale;
      const sx = mx + (hx - trailX(rz)) * scale, sy = my + (z - rz) * scale;
      if (Math.abs(sy - my) < mr + 20 * s) ctx.fillRect(sx - w / 2, sy - d / 2, w, d);
    }
    // the road
    ctx.strokeStyle = 'rgba(232,206,160,0.9)'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = -40; k <= 40; k++) {
      const z = rz + k;
      const sx = mx + (trailX(z) - trailX(rz)) * scale, sy = my + k * scale;
      if (k === -40) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    // games created so far, as markers where they appeared
    for (const g of this.markers || []) {
      if (t < g.t) continue;
      const sx = mx + (g.x - trailX(rz)) * 3.2 * scale, sy = my + (g.z - rz) * scale;
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(sx - 7.5 * s, sy - 7.5 * s, 15 * s, 15 * s);
      ctx.fillStyle = PEACH;
      ctx.fillRect(sx - 5.5 * s, sy - 5.5 * s, 11 * s, 11 * s);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.lineWidth = 5 * s; ctx.strokeStyle = '#c9a26a'; ctx.stroke();
    ctx.lineWidth = 2 * s; ctx.strokeStyle = 'rgba(255,236,200,0.6)'; ctx.stroke();
    // player arrow
    ctx.fillStyle = PEACH;
    ctx.beginPath(); ctx.moveTo(mx, my - 12 * s); ctx.lineTo(mx + 8 * s, my + 9 * s); ctx.lineTo(mx, my + 4 * s); ctx.lineTo(mx - 8 * s, my + 9 * s); ctx.closePath(); ctx.fill();
    ctx.font = this.font(18); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('N', mx, my - mr + 22 * s);
    // zone name + quest tracker on a dark panel under the map
    const qw = 300 * s, qh = 132 * s, qx1 = W - 44 * s, qx0 = qx1 - qw, qy0 = my + mr + 14 * s;
    ctx.save();
    roundRect(ctx, qx0, qy0, qw, qh, 16 * s);
    ctx.fillStyle = 'rgba(10,11,14,0.62)';
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'right';
    const qx = qx1 - 16 * s;
    ctx.font = this.font(24); ctx.fillStyle = PEACH;
    ctx.fillText('spawn village', qx, qy0 + 32 * s);
    ctx.font = this.font(20); ctx.fillStyle = 'rgba(255,217,160,0.8)';
    ctx.fillText('quest', qx, qy0 + 62 * s);
    ctx.font = this.font(27); ctx.fillStyle = '#fff';
    ctx.fillText('make anything', qx, qy0 + 92 * s);
    const n = this.spawned || 0;
    const bump = this.spawnedAt ? Math.exp(-(t - this.spawnedAt) * 8) : 0;
    ctx.font = this.font(23 * (1 + 0.12 * bump)); ctx.fillStyle = `rgba(255,255,255,${0.8 + 0.2 * bump})`;
    ctx.fillText(`games created ${n}/22`, qx, qy0 + 120 * s);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawStreaks() {
    const { ctx, s } = this;
    for (const st of this.streaks) {
      const x0 = st.x0 ?? this.barAnchor.x, y0 = st.y0 ?? this.barAnchor.y;
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
