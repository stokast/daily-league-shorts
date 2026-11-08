// A prompt floating in the air: Spawn's input bar as a 3D card that types itself (pixel font, block
// cursor, peach sparkle, send button), flashes on enter, then stays as a caption.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, easeOutCubic, easeOutBack } from './util.js';

const PEACH = '#ffd9a0';
const SPARK = [[14, 0, 1], [14, 1, 1], [13, 2, 3], [12, 3, 5], [10, 4, 9], [12, 5, 5], [13, 6, 3], [14, 7, 1], [14, 8, 1]];

const count = (keys, t) => { let n = 0; while (n < keys.length && keys[n] <= t) n++; return n; };

export class PromptCard {
  /**
   * @param {string} text the prompt
   * @param {number[]} keys time each character appears
   * @param {number} enter time it's sent
   * @param {'big'|'small'} size texture resolution
   * @param {string|null} highlight a word drawn in peach once typed (e.g. 'anything')
   */
  constructor(text, keys, enter, size = 'big', highlight = null, { tail = false } = {}) {
    this.text = text;
    this.keys = keys;
    this.enter = enter;
    this.highlight = highlight;
    const W = size === 'big' ? 1400 : 1000;
    const H = Math.round(W / 7);
    this.W = W; this.H = H;
    // a speech bubble gets a little tail under it, pointing at whoever is talking
    this.tailH = tail ? Math.round(H * 0.3) : 0;
    this.aspectInv = (H + this.tailH) / W;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H + this.tailH;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex.anisotropy = 4;
    // fit the font so the whole prompt sits on one line
    this.left = H * 0.66;
    this.right = H * 1.02;
    this.ctx.font = '100px "Geist Pixel"';
    const w100 = this.ctx.measureText(text).width;
    this.px = Math.min(H * 0.42, ((W - this.left - this.right - H * 0.3) / w100) * 100);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, (H + this.tailH) / W), this.mat);
    this.mesh.renderOrder = 3;
    this.base = 1;
    this.state = null;
  }

  /** Set the card up for time t (cardIn: when it appeared; pulse: 0..1 extra glow). */
  update(t, cardIn, pulse = 0) {
    const n = count(this.keys, t);
    const sent = t >= this.enter;
    const typing = !sent && n > 0 && t - this.keys[n - 1] < 0.35;
    const blink = !sent && (typing || ((t - cardIn) * 1.9) % 1 < 0.55);
    const flash = sent ? Math.max(0, 1 - (t - this.enter) / 0.28) : 0;
    const key = `${n}|${blink}|${Math.round(flash * 24)}|${Math.round(pulse * 12)}`;
    if (key !== this.state) {
      this.state = key;
      this.draw(n, blink, flash, pulse);
      this.tex.needsUpdate = true;
    }
    const appear = easeOutCubic((t - cardIn) / 0.22);
    const pop = lerp(0.82, 1, easeOutBack(clamp((t - cardIn) / 0.3), 2.2)) * (1 + 0.05 * flash);
    this.mesh.scale.setScalar(this.base * pop);
    // once sent it settles back a little, as the game's caption
    this.mat.opacity = appear * (sent ? lerp(1, 0.82, smoothstep(this.enter + 0.4, this.enter + 1.2, t)) : 1);
  }

  draw(n, blink, flash, pulse) {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H + this.tailH);
    const m = 5, r = (H - 2 * m) * 0.32;
    if (this.tailH) {
      // tail: a small wedge under the bubble, toward the speaker
      const tx = W * 0.5, tw = H * 0.32;
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2, H - m - 2);
      ctx.lineTo(tx + tw / 2, H - m - 2);
      ctx.lineTo(tx, H + this.tailH - 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(9,10,12,0.88)';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();
    }
    roundRect(ctx, m, m, W - 2 * m, H - 2 * m, r);
    ctx.fillStyle = 'rgba(9,10,12,0.88)';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = flash > 0 ? `rgba(255,217,160,${0.35 + 0.65 * flash})` : `rgba(255,255,255,${0.2 + 0.25 * pulse})`;
    ctx.stroke();
    // sparkle (Spawn's mark)
    const cell = H * 0.032;
    const sx = H * 0.36, sy = H / 2;
    ctx.save();
    ctx.fillStyle = PEACH;
    ctx.shadowColor = 'rgba(255,217,160,0.8)';
    ctx.shadowBlur = cell * 4;
    for (const [x, y, w] of SPARK) ctx.fillRect(sx + (x - 14.5) * cell, sy + (y - 4.5) * cell, w * cell + 0.5, cell + 0.5);
    ctx.restore();
    // text
    const typed = this.text.slice(0, n);
    const base = H / 2 + this.px * 0.33;
    ctx.font = `${this.px}px "Geist Pixel"`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    let tw;
    const hi = this.highlight ? this.text.indexOf(this.highlight) : -1;
    if (hi >= 0 && typed.length > hi) {
      const pre = typed.slice(0, hi);
      ctx.fillText(pre, this.left, base);
      const pw = ctx.measureText(pre).width;
      ctx.save();
      ctx.fillStyle = PEACH;
      ctx.shadowColor = 'rgba(255,217,160,0.8)';
      ctx.shadowBlur = this.px * 0.3;
      ctx.fillText(typed.slice(hi), this.left + pw, base);
      ctx.restore();
      tw = pw + ctx.measureText(typed.slice(hi)).width;
    } else {
      ctx.fillText(typed, this.left, base);
      tw = ctx.measureText(typed).width;
    }
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.left + tw + this.px * 0.08, base - this.px * 0.78, this.px * 0.42, this.px * 0.95);
    }
    // send button
    const bs = H * 0.56, bx = W - m - H * 0.22 - bs, by = (H - bs) / 2;
    roundRect(ctx, bx, by, bs, bs, bs * 0.28);
    ctx.fillStyle = flash > 0 ? `rgba(255,217,160,${0.4 + 0.6 * flash})` : n > 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    arrow(ctx, bx + bs / 2, by + bs / 2, bs * 0.36, n > 0 || flash > 0 ? '#0b0c0e' : 'rgba(255,255,255,0.55)');
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
function arrow(ctx, cx, cy, size, color) {
  const u = size / 5;
  ctx.fillStyle = color;
  ctx.fillRect(cx - u / 2 - 0.5, cy - 2 * u, u + 1, 4.5 * u);
  ctx.fillRect(cx - 1.5 * u, cy - 1 * u, u, u);
  ctx.fillRect(cx + 0.5 * u, cy - 1 * u, u, u);
  ctx.fillRect(cx - 2.5 * u, cy, u, u);
  ctx.fillRect(cx + 1.5 * u, cy, u, u);
}
