// The prompts and title screens floating in the air. Each game starts as a prompt card (Spawn's input
// bar, floating in the world) that types itself; on enter its screen spawns above it with a pixel
// dissolve, and the prompt stays under it as a caption. Heroes take centre stage then move aside; the
// montage fills the sky with prompts typing several at once; at the end everything is pulled into the
// vortex.
import * as THREE from 'three';
import { PROMPTS, MONTAGE, SPAWNS, OUT, CLIMAX } from './timeline.js';
import { PromptCard } from './promptcard.js';
import { clamp, lerp, smoothstep, invLerp, easeOutCubic, easeInOutCubic, easeInCubic, easeOutBack, rng, hash } from './util.js';

const TAN_V = Math.tan(THREE.MathUtils.degToRad(31)); // half vertical fov (62 deg)

// Where things go, in frame-normalised coords (sx, sy in -1..1 of the frame at that depth) and depth d.
const STAGE = { sx: 0, sy: 0.33, d: 6.3, w: 3.25 };
const ASIDE = {
  fighter: { sx: -0.98, sy: 0.6, d: 9.0, w: 3.0 },
  shooter: { sx: 1.0, sy: 0.36, d: 9.6, w: 3.0 },
  traitor: { sx: -0.92, sy: 0.02, d: 8.6, w: 2.9 },
  dogboss: { sx: 0.84, sy: 0.84, d: 11.5, w: 2.6 },
  racing: { sx: -0.5, sy: 1.02, d: 12.5, w: 2.9 },
  zombie: { sx: 0.97, sy: -0.06, d: 9.2, w: 2.8 },
};
// montage: each new screen lands near the front, alternating around the sky; older ones recede
const MONTAGE_SLOTS = [
  { sx: -0.40, sy: 0.36 }, { sx: 0.44, sy: 0.64 }, { sx: -0.36, sy: -0.02 }, { sx: 0.42, sy: 0.12 },
  { sx: 0.0, sy: 0.86 }, { sx: -0.56, sy: 0.72 }, { sx: 0.56, sy: 0.38 }, { sx: -0.1, sy: 0.2 },
  { sx: 0.36, sy: 0.92 }, { sx: -0.62, sy: 0.12 }, { sx: 0.62, sy: -0.02 }, { sx: -0.22, sy: 0.56 },
  { sx: 0.24, sy: 0.3 }, { sx: -0.46, sy: 0.96 }, { sx: 0.5, sy: 0.76 }, { sx: 0.0, sy: 0.02 },
];
const MONTAGE_D = 8.4, MONTAGE_W = 2.55, MONTAGE_PUSH = 1.7;

function localFromSlot(slot, aspect) {
  return new THREE.Vector3(slot.sx * TAN_V * aspect * slot.d, slot.sy * TAN_V * slot.d, -slot.d);
}

const PANEL_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PANEL_FS = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 uTexSize, uCells;
  uniform float uReveal, uFlash, uSeed, uBright, uFade;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.13) * 43758.5453); }
  vec3 tap(vec2 uv) { return texture2D(map, uv).rgb; }
  void main() {
    vec2 cell = floor(vUv * uCells);
    float th = h(cell);
    float dc = length((cell + 0.5) / uCells - 0.5);
    float k = th * 0.62 + dc * 0.55;
    float edge = uReveal * 1.3 - k;
    if (edge < 0.0) discard;
    // footprint-aware supersampling (textures have no mipmaps)
    vec2 du = dFdx(vUv), dv = dFdy(vUv);
    float fp = max(length(du * uTexSize), length(dv * uTexSize));
    vec3 col = tap(vUv);
    if (fp > 1.25) {
      vec2 a = du * 0.3, b = dv * 0.3;
      col += tap(vUv + a + b) + tap(vUv - a - b) + tap(vUv + a - b) + tap(vUv - a + b);
      if (fp > 2.4) {
        vec2 a2 = du * 0.45, b2 = dv * 0.45;
        col += tap(vUv + a2) + tap(vUv - a2) + tap(vUv + b2) + tap(vUv - b2);
        col /= 9.0;
      } else col /= 5.0;
    }
    col *= uBright;
    float hot = smoothstep(0.16, 0.0, edge) * step(uReveal, 0.999);
    col = mix(col, vec3(1.0, 0.86, 0.65) * 1.6, hot * 0.85);
    col += vec3(1.0, 0.95, 0.9) * uFlash;
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;
const BEZEL_FS = /* glsl */ `
  uniform vec2 uSize; uniform float uR, uBorder, uA, uGlow; uniform vec3 uEdge;
  varying vec2 vUv;
  float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRound(p, uSize * 0.5, uR);
    if (d > 0.0) discard;
    float edge = smoothstep(-uBorder, 0.0, d) * (1.0 - smoothstep(-0.003, 0.0, d));
    vec3 col = vec3(0.035, 0.037, 0.05);
    col += uEdge * edge * (0.9 + uGlow);
    gl_FragColor = vec4(col, uA);
  }
`;
const HALO_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uA; varying vec2 vUv;
  void main() { vec2 p = (vUv - 0.5) * 2.0; float r = length(p * vec2(1.0, 1.25)); float a = exp(-r * r * 3.2) * uA; gl_FragColor = vec4(uColor * a, 1.0); }
`;

class Panel {
  constructor(spawn, mod, index) {
    this.spawn = spawn;
    this.id = spawn.screen;
    this.kind = spawn.kind;
    this.index = index;
    this.meta = mod?.meta || { id: this.id, title: this.id.toUpperCase(), aspect: 16 / 9 };
    this.aspect = this.meta.aspect || 16 / 9;
    const big = this.kind !== 'montage';
    const cw = big ? (this.aspect < 1.5 ? 960 : 1280) : 768;
    const ch = Math.round(cw / this.aspect);
    this.cw = cw; this.ch = ch;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cw; this.canvas.height = ch;
    this.ctx = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bg.width = cw; this.bg.height = ch;
    try {
      this.inst = mod ? mod.create(cw, ch) : placeholder(this.meta.title, cw, ch);
      this.inst.bg(this.bg.getContext('2d'));
    } catch (e) {
      console.warn('screen failed, using placeholder:', this.id, e.message);
      this.inst = placeholder(this.meta.title, cw, ch);
      this.inst.bg(this.bg.getContext('2d'));
    }
    this.drawnAt = null;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.avg = averageColor(this.bg);

    this.group = new THREE.Group();
    const w = 1, h = 1 / this.aspect;
    this.uni = {
      map: { value: this.tex }, uTexSize: { value: new THREE.Vector2(cw, ch) },
      uCells: { value: new THREE.Vector2(32, Math.round(32 / this.aspect)) },
      uReveal: { value: 0 }, uFlash: { value: 0 }, uSeed: { value: index * 1.37 }, uBright: { value: 0.96 }, uFade: { value: 1 },
    };
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: PANEL_VS, fragmentShader: PANEL_FS }));
    this.screen.renderOrder = 2;
    const bw = w * 1.035, bh = h + w * 0.035;
    this.bezU = {
      uSize: { value: new THREE.Vector2(bw, bh) }, uR: { value: 0.03 }, uBorder: { value: 0.006 }, uA: { value: 0 },
      uGlow: { value: 0 }, uEdge: { value: new THREE.Color('#ffd9a0') },
    };
    this.bezel = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.ShaderMaterial({
      uniforms: this.bezU, vertexShader: PANEL_VS, fragmentShader: BEZEL_FS, transparent: true, depthWrite: false,
    }));
    this.bezel.position.z = -0.004;
    this.bezel.renderOrder = 1;
    this.haloU = { uColor: { value: this.avg.clone().lerp(new THREE.Color(1, 0.85, 0.65), 0.3) }, uA: { value: 0 } };
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.9, h * 2.1), new THREE.ShaderMaterial({
      uniforms: this.haloU, vertexShader: PANEL_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.halo.position.z = -0.02;
    this.halo.renderOrder = 0;
    this.group.add(this.halo, this.bezel, this.screen);
    // the prompt that makes this game, floating under where the screen appears
    this.card = new PromptCard(spawn.text, spawn.keys, spawn.enter, this.kind === 'montage' ? 'small' : 'big');
    const cardW = 0.86;
    this.card.base = cardW;
    this.cardBelow = -(0.5 / this.aspect) - 0.05 - (cardW * this.card.aspectInv) / 2;
    this.cardAbove = -this.cardBelow;
    this.card.mesh.position.set(0, this.cardBelow, 0.01);
    this.group.add(this.card.mesh);
    this.group.visible = false;
    const r = rng(1000 + index * 7);
    this.jit = { yaw: (r() - 0.5) * 0.28, roll: (r() - 0.5) * 0.1, pitch: (r() - 0.5) * 0.12, ph: r() * 10 };
  }

  /** Redraw the screen canvas for local time lt (quantised so renders are reproducible). */
  paint(lt) {
    const rate = lt < 1.4 ? 30 : this.kind === 'montage' ? 10 : 15;
    const q = Math.floor(lt * rate + 1e-6) / rate;
    if (q === this.drawnAt) return;
    this.drawnAt = q;
    const { ctx } = this;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0);
    ctx.save();
    try { this.inst.fg(ctx, q); } catch (e) { if (!this.warned) { console.warn('fg failed:', this.id, e.message); this.warned = true; } }
    ctx.restore();
    this.tex.needsUpdate = true;
  }
}

export class Panels {
  constructor(W, H, world, overlay) {
    this.W = W; this.H = H;
    this.world = world;
    this.overlay = overlay;
    this.aspectFrame = W / H;
    this.panels = [];
    this.group = new THREE.Group();
    world.scene.add(this.group);
  }

  async init() {
    const ids = [...new Set(SPAWNS.map((s) => s.screen))];
    const mods = {};
    await Promise.all(ids.map(async (id) => {
      try { mods[id] = await import(`./screens/${id}.js`); } catch (e) { console.warn('screen missing, using placeholder:', id, e.message); }
    }));
    for (const m of MONTAGE) m.word = mods[m.screen]?.meta?.word || m.screen;
    SPAWNS.forEach((s, i) => {
      const p = new Panel(s, mods[s.screen], i);
      this.panels.push(p);
      this.group.add(p.group);
    });
    // burst particles shared by all panels
    this.BURST = 30;
    this.burst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.panels.length * this.BURST);
    const cols = ['#ffffff', '#ffd9a0', '#7ff0ff', '#ffd9a0'].map((c) => new THREE.Color(c).multiplyScalar(1.6));
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.panels.length * this.BURST; i++) {
      this.burst.setColorAt(i, cols[i % cols.length]);
      this.burst.setMatrixAt(i, zero);
    }
    this.burst.frustumCulled = false;
    this.world.scene.add(this.burst);
    // the last prompt: "i want to make anything", front and centre
    this.climax = new PromptCard(CLIMAX.text, CLIMAX.keys, CLIMAX.enter, 'big', 'anything');
    this.world.scene.add(this.climax.mesh);
  }

  /** Local (camera-follow) placement of a panel at time t: { pos, width, look } or null. */
  place(p, t) {
    const s = p.spawn;
    const a = this.aspectFrame;
    const stage = localFromSlot(STAGE, a);
    let pos, w, onStage = 0;
    if (s.kind === 'montage') {
      const slot = MONTAGE_SLOTS[s.index % MONTAGE_SLOTS.length];
      // every later spawn pushes this one back and outward
      let push = 0;
      for (const m of MONTAGE) if (m.index > s.index) push += easeOutCubic(invLerp(m.cardIn, m.cardIn + 0.3, t));
      const out = 1 + push * 0.07;
      pos = localFromSlot({ sx: slot.sx * out, sy: 0.4 + (slot.sy - 0.4) * out, d: MONTAGE_D + push * MONTAGE_PUSH }, a);
      w = MONTAGE_W;
    } else {
      // centre stage until the next prompt is sent, then move to its side slot
      const next = PROMPTS[s.index + 1];
      const asideAt = next ? next.enter : MONTAGE[0].cardIn - 0.1;
      const aside = localFromSlot(ASIDE[s.screen], a);
      const u = easeInOutCubic(invLerp(asideAt, asideAt + 0.6, t));
      onStage = 1 - u;
      const drift = Math.max(0, Math.min(t, asideAt) - s.impact) * 0.16;
      const st = stage.clone(); st.z += drift;
      pos = st.lerp(aside, u);
      // arc outward while moving
      pos.z -= Math.sin(u * Math.PI) * 1.2;
      w = lerp(STAGE.w, ASIDE[s.screen].w, u);
    }
    // everything slowly comes towards you (you're moving forward)
    pos.z += Math.max(0, t - s.cardIn) * 0.09;
    return { pos, w, onStage };
  }

  update(t, post) {
    const cam = this.world.camera;
    // screens live in the frame of the walk (no head bob), so the bob moves them like the rest of the world
    const { pos: camPos, quat: followQ } = this.world.basePose(t);
    const streaks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
    const vortex = easeInCubic(invLerp(OUT.vortex[0], OUT.vortex[1], t));
    const climaxPulse = Math.exp(-Math.max(0, t - CLIMAX.enter) * 6) * (t >= CLIMAX.enter ? 1 : 0);

    const toScreen = (v) => { const sp = v.clone().project(cam); return { x: (sp.x * 0.5 + 0.5) * this.W, y: (0.5 - sp.y * 0.5) * this.H }; };
    this.panels.forEach((p, i) => {
      const s = p.spawn;
      const lt = t - s.impact;
      const zeroBurst = () => { m4.makeScale(0, 0, 0); for (let k = 0; k < this.BURST; k++) this.burst.setMatrixAt(i * this.BURST + k, m4); };
      if (t < s.cardIn) { p.group.visible = false; zeroBurst(); return; }
      const pl = this.place(p, t);
      let local = pl.pos.clone();
      let w = pl.w;
      // vortex: spiral into the centre and shrink
      if (vortex > 0) {
        const target = new THREE.Vector3(0, 0.25 * TAN_V * 10, -10);
        local.lerp(target, vortex);
        const ang = vortex * 2.4;
        const x = local.x, y = local.y - target.y;
        local.x = x * Math.cos(ang) - y * Math.sin(ang);
        local.y = target.y + x * Math.sin(ang) + y * Math.cos(ang);
        w *= 1 - 0.85 * vortex;
      }
      const world = camPos.clone().add(local.applyQuaternion(followQ));
      p.group.visible = true;
      p.group.position.copy(world);
      // face the camera, with a little personality
      p.group.lookAt(cam.position);
      const idle = Math.sin(t * 0.9 + p.jit.ph);
      const jitK = s.kind === 'montage' ? 1 : (1 - pl.onStage);
      p.group.rotateY(p.jit.yaw * jitK + idle * 0.03);
      p.group.rotateX(p.jit.pitch * jitK + Math.sin(t * 0.7 + p.jit.ph) * 0.02);
      p.group.rotateZ(p.jit.roll * jitK + vortex * 1.5);
      const pop = lt < 0 ? 1 : lerp(0.94, 1, easeOutBack(clamp(lt / 0.35), 2.5));
      p.group.scale.setScalar(w * pop);

      // the prompt card: types, sends, then stays as the screen's caption; for the heroes it floats up
      // above its screen when the next prompt appears below
      if (s.kind !== 'montage') {
        const next = PROMPTS[s.index + 1];
        const flipAt = next ? next.cardIn : MONTAGE[0].cardIn;
        const f = easeInOutCubic(invLerp(flipAt, flipAt + 0.45, t));
        p.card.mesh.position.set(0, lerp(p.cardBelow, p.cardAbove, f), 0.01 + Math.sin(f * Math.PI) * 0.08);
      }
      p.card.update(t, s.cardIn, climaxPulse);
      // streak from the card up into the screen, between enter and impact
      if (t >= s.enter && lt < 0.02) {
        const from = toScreen(p.card.mesh.getWorldPosition(new THREE.Vector3()));
        const to = toScreen(p.group.position);
        streaks.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, u: clamp((t - s.enter) / Math.max(0.05, s.impact - s.enter)), kind: s.kind });
      }
      if (lt < 0) {
        // card only: the screen hasn't spawned yet
        p.uni.uReveal.value = 0;
        p.bezU.uA.value = 0;
        p.haloU.uA.value = 0;
        zeroBurst();
        return;
      }

      // reveal + flash
      const reveal = clamp(lt / 0.34);
      p.uni.uReveal.value = reveal;
      p.uni.uFlash.value = Math.max(0, 1 - lt / 0.22) * 0.55 + climaxPulse * 0.35;
      p.uni.uFade.value = 1;
      p.bezU.uA.value = 0.92 * smoothstep(0.0, 0.25, lt);
      p.bezU.uGlow.value = Math.max(0, 1 - lt / 0.5) * 2 + climaxPulse * 1.5;
      p.haloU.uA.value = 0.28 * smoothstep(0, 0.4, lt) + Math.max(0, 1 - lt / 0.4) * 0.5;
      const pxW = (w / Math.max(0.5, -local.z)) / (2 * TAN_V * this.aspectFrame) * this.W;
      if (pxW > 140 || lt < 1.2 || p.drawnAt === null) p.paint(lt);

      // pixel burst from the panel's edges
      for (let k = 0; k < this.BURST; k++) {
        const idx = i * this.BURST + k;
        const bt = lt;
        if (bt > 0.9 || vortex > 0) { m4.makeScale(0, 0, 0); this.burst.setMatrixAt(idx, m4); continue; }
        const r1 = hash(i * 131 + k, 1), r2 = hash(i * 131 + k, 2), r3 = hash(i * 131 + k, 3);
        // a point on the panel's border, flying outward
        const side = Math.floor(r1 * 4);
        const along = r2 - 0.5;
        const hh = 0.5 / p.aspect;
        let ex = 0, ey = 0, dx = 0, dy = 0;
        if (side === 0) { ex = along; ey = hh; dy = 1; } else if (side === 1) { ex = along; ey = -hh; dy = -1; } else if (side === 2) { ex = -0.5; ey = along / p.aspect; dx = -1; } else { ex = 0.5; ey = along / p.aspect; dx = 1; }
        const dist = (0.08 + r3 * 0.22) * easeOutCubic(bt / 0.9);
        pp.set(ex + dx * dist + (r3 - 0.5) * 0.05, ey + dy * dist, (r2 - 0.5) * 0.1).multiplyScalar(w);
        pp.applyQuaternion(p.group.quaternion).add(p.group.position);
        const size = w * 0.018 * (0.5 + r2) * (1 - bt / 0.9);
        q.copy(p.group.quaternion);
        sc.setScalar(size);
        m4.compose(pp, q, sc);
        this.burst.setMatrixAt(idx, m4);
      }
    });
    this.burst.instanceMatrix.needsUpdate = true;

    // the climax card, then into the vortex
    const cm = this.climax.mesh;
    cm.visible = t >= CLIMAX.cardIn && t < OUT.flash;
    if (cm.visible) {
      this.climax.base = 2.9 * (1 - 0.85 * vortex);
      this.climax.update(t, CLIMAX.cardIn, 0);
      const local = new THREE.Vector3(0, 0.12 * TAN_V * 6.0, -6.0);
      local.z += (t - CLIMAX.cardIn) * 0.12;
      if (vortex > 0) local.lerp(new THREE.Vector3(0, 0.25 * TAN_V * 10, -10), vortex);
      cm.position.copy(camPos.clone().add(local.applyQuaternion(followQ)));
      cm.lookAt(cam.position);
      cm.rotateZ(vortex * 1.5);
    }
    this.overlay.streaks = streaks;
  }
}

function averageColor(canvas) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  const x = c.getContext('2d');
  x.drawImage(canvas, 0, 0, 4, 4);
  const d = x.getImageData(0, 0, 4, 4).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
}

function placeholder(title, w, h) {
  return {
    bg(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#24245a'); g.addColorStop(1, '#a04a7a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    fg(ctx, t) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `${Math.round(h * 0.16)}px "Bungee"`;
      ctx.fillText(title, w / 2, h * 0.5);
      if ((t * 1.6) % 1 < 0.6) { ctx.font = `${Math.round(h * 0.05)}px "Press Start 2P"`; ctx.fillText('PRESS START', w / 2, h * 0.8); }
    },
  };
}
