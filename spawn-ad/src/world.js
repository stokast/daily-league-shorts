// The game world: after the cable you're walking a grassy trail through an MMO-style village at dusk,
// looking up at the sky where the games you prompt appear. Low-poly and flat-shaded, in Spawn's colours.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W0, OUT, BEAT } from './timeline.js';
import { clamp, lerp, smoothstep, invLerp, easeOutCubic, easeInOutCubic, easeInCubic, rng, fbm, hash, TAU } from './util.js';

const C = (hex) => new THREE.Color(hex); // sRGB hex -> linear working colour
const SUN_DIR = new THREE.Vector3(-0.32, 0.075, -1).normalize();

const WALK_SPEED = 1.25; // metres per second: an easy stroll
const EYE = 1.7;
const PITCH = 10; // degrees up: looking at the sky
const Z_START = 3.0;
/** The trail's centre line. */
export const trailX = (z) => 1.1 * Math.sin(z * 0.055 + 0.5) - 0.45;

export class World {
  constructor(W, H) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, W / H, 0.08, 3000);
    this.scene.fog = new THREE.Fog(C('#d99a95'), 38, 330);
    this.t = 0;
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildGrass();
    this.buildVillage();
    this.buildLandmarks();
    this.buildMountains();
    this.buildIslands();
    this.buildClouds();
    this.buildSmoke();
    this.buildMotes();
  }

  // ------------------------------------------------------------------ camera
  /** Where the walk is at time t, without the head bob (the title screens follow this). */
  basePose(t) {
    const z = Z_START - WALK_SPEED * Math.max(0, t - W0);
    const x = trailX(z) * 0.85;
    const pos = new THREE.Vector3(x, this.groundAt(x, z) + EYE, z);
    // heading follows the trail, smoothed
    const ahead = z - 6;
    const yaw = Math.atan2(-(trailX(ahead) * 0.85 - x), 6) * 0.6;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(PITCH), yaw, 0, 'YXZ'));
    return { pos, quat };
  }

  /** Camera pose at time t: the walk plus a gentle head bob in step with the beat. */
  camPose(t) {
    const { pos, quat } = this.basePose(t);
    const ph = Math.PI * (t - W0) / BEAT; // one step per beat
    const bob = 0.032 * Math.abs(Math.sin(ph));
    const sway = 0.018 * Math.sin(ph);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    pos.y += bob - 0.016;
    pos.addScaledVector(right, sway);
    const roll = THREE.MathUtils.degToRad(0.35) * Math.sin(ph);
    const look = THREE.MathUtils.degToRad(0.6) * Math.sin(t * 0.37 + 0.4); // a slow glance
    quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(0.25) * Math.cos(2 * ph), look, roll, 'YXZ')));
    // the vortex: lunge forward as everything is pulled in
    const v = easeInCubic(invLerp(OUT.vortex[0], OUT.vortex[1], t));
    if (v > 0) pos.add(new THREE.Vector3(0, 0, -1).applyQuaternion(quat).multiplyScalar(v * 3));
    return { pos, quat };
  }

  groundAt(x, z) {
    const path = Math.abs(x - trailX(z));
    let h = fbm(x * 0.05, z * 0.05, 3) * 0.6 * smoothstep(1.5, 6, path);
    const r = Math.hypot(x, z + 30);
    h += Math.max(0, fbm(x * 0.012 + 3, z * 0.012 - 2, 4)) * 38 * smoothstep(45, 170, r);
    h += smoothstep(14, 60, path) * 2.5;
    return h;
  }

  // ------------------------------------------------------------------ sky
  buildSky() {
    this.skyU = {
      uSun: { value: SUN_DIR.clone() },
      uTime: { value: 0 },
      uZenith: { value: C('#0d0b2a') },
      uMid: { value: C('#3a2468') },
      uLow: { value: C('#b8507e') },
      uHor: { value: C('#ffb38a') },
      uSunCol: { value: C('#ffd9a0') },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), new THREE.ShaderMaterial({
      uniforms: this.skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uZenith, uMid, uLow, uHor, uSunCol;
        uniform float uTime;
        varying vec3 vDir;
        float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHor, uLow, smoothstep(0.0, 0.10, h));
          col = mix(col, uMid, smoothstep(0.07, 0.38, h));
          col = mix(col, uZenith, smoothstep(0.32, 0.95, h));
          col = mix(col, uLow * 0.5, smoothstep(0.0, -0.15, h));
          float sd = max(dot(d, uSun), 0.0);
          col += uSunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 40.0) * 0.6);
          col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, sd) * 2.0;
          // pixel stars, square like Spawn's type
          vec3 q = floor(d * 320.0);
          float s = h3(q);
          float star = step(0.9965, s) * smoothstep(0.18, 0.55, h);
          star *= 0.55 + 0.45 * sin(uTime * (1.5 + 3.0 * fract(s * 91.0)) + s * 40.0);
          col += vec3(1.0, 0.95, 0.9) * star * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);
  }


  buildMountains() {
    const r = rng(77);
    const geos = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.5;
      const dist = 330 + r() * 260;
      const hgt = 70 + r() * 150;
      const g = new THREE.ConeGeometry(50 + r() * 80, hgt, 5 + Math.floor(r() * 3), 3);
      jitter(g, 9, 20 + i);
      g.rotateY(r() * TAU);
      g.translate(Math.cos(a) * dist, hgt / 2 - 12, Math.sin(a) * dist - 120);
      paint(g, (p) => C('#4b3a86').lerp(C('#e6a2b0'), clamp((p.y + 10) / 260)).lerp(C('#fbe2d6'), smoothstep(hgt * 0.75, hgt, p.y + 12) * 0.8));
      geos.push(g);
    }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.scene.add(m);
  }


  buildClouds() {
    const r = rng(31);
    this.clouds = [];
    const mat = new THREE.MeshLambertMaterial({ color: C('#fff1f3'), emissive: C('#7a4a7e'), flatShading: true });
    for (let i = 0; i < 18; i++) {
      const parts = [];
      const n = 5 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        const g = new THREE.IcosahedronGeometry(1 + r() * 1.3, 2);
        g.translate((k - n / 2) * 1.3 + r(), r() * 0.8, (r() - 0.5) * 1.4);
        parts.push(g);
      }
      const geo = mergeGeometries(parts);
      geo.scale(1, 0.6, 0.8);
      const m = new THREE.Mesh(geo, mat);
      const s = 3 + r() * 6;
      m.scale.setScalar(s);
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.2;
      const d = 90 + r() * 260;
      m.position.set(Math.cos(a) * d, 12 + r() * 50, Math.sin(a) * d - 40);
      m.userData = { x0: m.position.x, sp: 0.6 + r() * 0.8 };
      this.clouds.push(m);
      this.scene.add(m);
    }
  }


  buildMotes() {
    const N = 420;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3), c = new Float32Array(N * 3), ph = new Float32Array(N);
    const r = rng(21);
    const cols = [C('#ffd9a0'), C('#7ff0ff'), C('#ffffff')];
    for (let i = 0; i < N; i++) {
      p.set([(r() - 0.5) * 30, r() * 14, 4 - r() * 40], i * 3);
      const k = cols[i % 3];
      c.set([k.r, k.g, k.b], i * 3);
      ph[i] = r() * TAU;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.moteU = { uT: { value: 0 }, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.moteU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: /* glsl */ `
        uniform float uT, uScale; attribute float phase; varying vec3 vC; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uT * 0.25, 14.0);
          p.x += sin(uT * 0.6 + phase) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (6.0 + 4.0 * sin(phase * 3.0)) * (6.0 / -mv.z);
          vC = color; vA = 0.55 + 0.45 * sin(uT * 2.0 + phase * 5.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a * vA * 1.3, 1.0); }
      `,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }


  buildLights() {
    this.scene.add(new THREE.HemisphereLight(C('#a593ec'), C('#3d6b45'), 1.15));
    const key = new THREE.DirectionalLight(C('#ffc39c'), 1.9);
    key.position.set(0.25, 0.6, 0.75).multiplyScalar(100);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(C('#ffd2b0'), 0.75);
    fill.position.set(-0.8, 0.35, 0.3).multiplyScalar(100);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(C('#ff9fb0'), 0.85);
    rim.position.copy(SUN_DIR).multiplyScalar(100);
    this.scene.add(rim);
  }

  // ------------------------------------------------------------------ land and trail
  buildGround() {
    const geo = new THREE.PlaneGeometry(700, 700, 170, 170);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -220);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const g1 = C('#3f8f52'), g2 = C('#5aa85c'), g3 = C('#2f7550'), dirt = C('#a7825a'), rock = C('#7b6a8e'), snow = C('#f2d6d0');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.groundAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.09, z * 0.09, 2);
      c.copy(g1).lerp(g2, clamp(0.5 + n));
      c.lerp(g3, clamp(-n * 1.4));
      c.lerp(dirt, 1 - smoothstep(1.0, 1.9, Math.abs(x - trailX(z))));
      c.lerp(rock, smoothstep(10, 26, h));
      c.lerp(snow, smoothstep(30, 40, h));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    // the trail itself: a dirt ribbon with ragged edges, plus pebbles
    const segs = 260, across = 7;
    const tp = [], tc = [], ti = [];
    const r = rng(17);
    const dA = C('#b28c62'), dB = C('#8f6a46');
    for (let j = 0; j <= segs; j++) {
      const z = 10 - j * 0.4;
      for (let k = 0; k < across; k++) {
        const u = k / (across - 1) - 0.5;
        const edge = k === 0 || k === across - 1;
        const half = 0.98 + (edge ? (r() - 0.5) * 0.45 : 0);
        const x = trailX(z) + u * 2 * half;
        tp.push(x, this.groundAt(x, z) + 0.03 + (edge ? -0.02 : 0.0), z);
        const cc = dA.clone().lerp(dB, r() * 0.7 + Math.abs(u) * 0.4);
        tc.push(cc.r, cc.g, cc.b);
      }
    }
    for (let j = 0; j < segs; j++) for (let k = 0; k < across - 1; k++) {
      const a = j * across + k, b = a + 1, c2 = a + across, d = c2 + 1;
      ti.push(a, c2, b, b, c2, d);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    tg.setIndex(ti);
    tg.computeVertexNormals();
    this.scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    const pebGeo = new THREE.IcosahedronGeometry(1, 0);
    const pebbles = new THREE.InstancedMesh(pebGeo, new THREE.MeshLambertMaterial({ color: C('#c9c2b4'), flatShading: true }), 420);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 420; i++) {
      const z = 8 - r() * 95;
      const x = trailX(z) + (r() - 0.5) * 2.1;
      const sz = 0.025 + Math.pow(r(), 3) * 0.07;
      p.set(x, this.groundAt(x, z) + 0.02, z);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      s.set(sz * (1 + r()), sz * 0.5, sz);
      m.compose(p, q, s);
      pebbles.setMatrixAt(i, m);
      pebbles.setColorAt(i, C('#d8d0c2').multiplyScalar(0.8 + r() * 0.3));
    }
    this.scene.add(pebbles);
  }

  buildGrass() {
    // one tuft = a handful of blades, darker at the root; instanced and swaying in the wind
    const blades = [];
    const r = rng(23);
    for (let b = 0; b < 7; b++) {
      const h = 0.28 + r() * 0.32, w = 0.045 + r() * 0.03;
      const g = new THREE.BufferGeometry();
      const lean = (r() - 0.5) * 0.25;
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, lean, h, 0.02], 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute([0.35, 0.5, 0.3, 0.35, 0.5, 0.3, 1, 1, 1].map((v, i) => v), 3));
      g.rotateY(r() * Math.PI);
      g.translate((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18);
      blades.push(g);
    }
    const tuft = mergeGeometries(blades);
    tuft.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.grassU = { uT: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.grassU.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float sw = sin(uT * 1.7 + ip.x * 0.35 + ip.z * 0.22) + 0.4 * sin(uT * 3.1 + ip.z * 0.9);
          transformed.x += sw * 0.07 * position.y * 2.5;
          transformed.z += sw * 0.03 * position.y * 2.5;`);
    };
    const N = 5200;
    const grass = new THREE.InstancedMesh(tuft, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const greens = ['#5aa85c', '#4f9a52', '#6bb866', '#3f8a4a', '#7cc06a'].map(C);
    let i = 0;
    while (i < N) {
      const z = 9 - r() * 75;
      const side = r() < 0.5 ? -1 : 1;
      const off = 0.95 + Math.pow(r(), 1.6) * 16;
      const x = trailX(z) + side * off;
      p.set(x, this.groundAt(x, z), z);
      q.setFromEuler(new THREE.Euler(0, r() * TAU, 0));
      s.setScalar(0.8 + r() * 0.9);
      m.compose(p, q, s);
      grass.setMatrixAt(i, m);
      grass.setColorAt(i, greens[Math.floor(r() * greens.length)].clone().multiplyScalar(0.85 + r() * 0.3));
      i++;
    }
    grass.frustumCulled = false;
    this.scene.add(grass);

    // flowers in the grass
    const F = 700;
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: C('#3a2030'), flatShading: true }), F);
    const fc = ['#ff9fc0', '#ffe27a', '#ffffff', '#c9a6ff', '#ffb37a'].map(C);
    for (let k = 0; k < F; k++) {
      const z = 8 - r() * 60;
      const side = r() < 0.5 ? -1 : 1;
      const x = trailX(z) + side * (1.3 + Math.pow(r(), 1.3) * 9);
      p.set(x, this.groundAt(x, z) + 0.22 + r() * 0.15, z);
      s.setScalar(0.8 + r() * 0.8);
      m.compose(p, q.identity(), s);
      flowers.setMatrixAt(k, m);
      flowers.setColorAt(k, fc[Math.floor(r() * fc.length)]);
    }
    this.scene.add(flowers);
  }

  // ------------------------------------------------------------------ the village
  buildVillage() {
    const solids = [], glows = [];
    this.lanternPos = [];
    this.chimneys = [];
    const r = rng(41);
    const walls = ['#efe3c8', '#f2dcae', '#e9d2c4', '#e6e0cf', '#f0d7b8'];
    const roofs = ['#b5533c', '#4a5a86', '#2f6b6a', '#7a4a32', '#9a3f4f', '#3f5f8f'];
    const put = (geos, glowGeos, x, z, ry, y = null) => {
      const gy = y ?? this.groundAt(x, z);
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, gy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
      for (const g of geos) solids.push(g.applyMatrix4(mtx));
      for (const g of glowGeos) glows.push(g.applyMatrix4(mtx));
      return mtx;
    };

    // houses on both sides, fronts facing the trail
    const housesL = [-2, -10, -18.5, -36, -44, -53, -62, -71];
    const housesR = [-5.5, -13.5, -27, -35.5, -48, -57, -66];
    const addHouse = (z, side) => {
      const w = 4.6 + r() * 1.8, d = 4.2 + r() * 1.2, h = 3.0 + r() * 0.8, rh = 2.2 + r() * 0.9;
      const set = 4.3 + r() * 1.4;
      const x = trailX(z) + side * (set + d / 2);
      const hs = makeHouse(r, { w, d, h, rh, wall: walls[Math.floor(r() * walls.length)], roof: roofs[Math.floor(r() * roofs.length)] });
      const mtx = put(hs.solid, hs.glow, x, z, side < 0 ? Math.PI / 2 : -Math.PI / 2);
      this.chimneys.push(hs.chimney.applyMatrix4(mtx));
    };
    housesL.forEach((z) => addHouse(z, -1));
    housesR.forEach((z) => addHouse(z, 1));

    // lanterns along the trail
    for (let k = 0; k < 13; k++) {
      const z = -1 - k * 6.5;
      const side = k % 2 ? 1 : -1;
      const x = trailX(z) + side * 1.75;
      const l = makeLamp(side);
      const mtx = put(l.solid, l.glow, x, z, 0);
      this.lanternPos.push(l.light.applyMatrix4(mtx));
    }
    // fences between some houses
    for (const [z0, z1, side] of [[0.5, -6, 1], [-21, -31, -1], [-38.5, -45.5, 1], [-14, -17.5, -1]]) {
      for (let z = z0; z > z1; z -= 1.4) {
        const x = trailX(z) + side * 2.7;
        put(makeFence(), [], x, z, Math.atan2(trailX(z - 1.4) - trailX(z), -1.4) + Math.PI / 2);
      }
    }
    // market stall, well, cart, barrels and crates, banners
    put(makeStall(), [], trailX(-21.5) + 4.6, -21.5, -Math.PI / 2);
    put(makeWell(), [], trailX(-28.5) - 4.4, -28.5, 0.3);
    put(makeCart(), [], trailX(-8) - 3.4, -8, 0.5);
    for (let k = 0; k < 16; k++) {
      const z = -3 - r() * 60, side = r() < 0.5 ? -1 : 1;
      const x = trailX(z) + side * (2.9 + r() * 0.8);
      put(r() < 0.55 ? makeBarrel() : makeCrate(r), [], x, z, r() * TAU);
    }
    this.banners = [];
    for (const [z, side] of [[-16, 1], [-31, -1], [-46, 1]]) {
      const x = trailX(z) + side * 2.2;
      put(makeBannerPole(), [], x, z, 0);
      this.banners.push(new THREE.Vector3(x, this.groundAt(x, z), z));
    }
    // trees behind and between the houses
    for (let k = 0; k < 70; k++) {
      const z = 6 - r() * 95, side = r() < 0.5 ? -1 : 1;
      const off = 9 + r() * 22;
      const x = trailX(z) + side * off;
      put(r() < 0.6 ? makeTree(r) : makePine(r), [], x, z, r() * TAU);
    }
    for (const [z, side, off] of [[-24.5, 1, 6.5], [-40, -1, 6], [-58.5, 1, 6.2], [-7.5, 1, 6.8]]) {
      const x = trailX(z) + side * off;
      put(makeTree(r), [], x, z, r() * TAU);
    }

    const solid = new THREE.Mesh(mergeGeometries(solids), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.scene.add(solid);
    const glow = new THREE.Mesh(mergeGeometries(glows), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.scene.add(glow);

    // soft halos around the lanterns
    const halo = new THREE.Points(new THREE.BufferGeometry().setFromPoints(this.lanternPos), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = 900.0 / -mv.z; }',
      fragmentShader: 'void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*22.0); gl_FragColor = vec4(vec3(1.0,0.72,0.38)*a*0.4, 1.0); }',
    }));
    halo.frustumCulled = false;
    this.scene.add(halo);

    // banner cloth, waving
    this.flagU = { uT: { value: 0 } };
    const flags = [];
    for (const b of this.banners) {
      const g = new THREE.PlaneGeometry(0.75, 1.5, 8, 8);
      g.translate(0.4, 0, 0);
      const cols = [];
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const yy = pa.getY(i);
        const c = Math.abs(yy + 0.35) < 0.12 ? C('#ffd9a0') : C('#1d96a0');
        cols.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.translate(b.x + 0.05, b.y + 3.2, b.z);
      flags.push(g);
    }
    const flagMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    flagMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.flagU.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float u = clamp(uv.x, 0.0, 1.0);
          transformed.z += sin(uT * 3.0 + uv.x * 5.0 + position.y) * 0.12 * u;`);
    };
    this.scene.add(new THREE.Mesh(mergeGeometries(flags), flagMat));
  }

  buildLandmarks() {
    // a windmill over the rooftops, its sails turning
    const wx = trailX(-66) - 12, wz = -66;
    const wy = this.groundAt(wx, wz);
    const tower = [];
    const body = new THREE.CylinderGeometry(1.5, 2.3, 8.5, 8);
    body.translate(0, 4.25, 0);
    tower.push(prep(body, C('#e9dcc4')));
    const cap = new THREE.ConeGeometry(2.0, 2.4, 8);
    cap.translate(0, 9.6, 0);
    tower.push(prep(cap, C('#9a3f4f')));
    const door = new THREE.BoxGeometry(1.0, 1.8, 0.2);
    door.translate(0, 0.9, 2.15);
    tower.push(prep(door, C('#4a2e1e')));
    const tm = new THREE.Mesh(mergeGeometries(tower), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    tm.position.set(wx, wy, wz);
    tm.rotation.y = 0.9;
    this.scene.add(tm);
    const sails = [];
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.BoxGeometry(0.22, 6.2, 0.12);
      arm.translate(0, 3.2, 0);
      const cloth = new THREE.BoxGeometry(1.1, 4.6, 0.05);
      cloth.translate(0.7, 3.9, 0.02);
      const g = mergeGeometries([prep(arm, C('#6b4a32')), prep(cloth, C('#f4ede1'))]);
      g.rotateZ(k * Math.PI / 2);
      sails.push(g);
    }
    this.windmillSails = new THREE.Mesh(mergeGeometries(sails), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const hub = new THREE.Object3D();
    hub.position.set(wx, wy + 8.2, wz);
    hub.rotation.y = 0.9;
    hub.add(this.windmillSails);
    this.windmillSails.position.z = 2.0;
    this.scene.add(hub);

    // a castle on a hill, far ahead
    const cx = 24, cz = -135;
    const hill = new THREE.ConeGeometry(34, 14, 9, 2);
    jitter(hill, 4, 77);
    hill.translate(0, 5, 0);
    const parts = [prep(hill, C('#3f7d55'))];
    const stone = C('#b7aeb8'), roof = C('#4a5a86');
    const keep = new THREE.BoxGeometry(9, 15, 9); keep.translate(0, 19.5, 0); parts.push(prep(keep, stone));
    for (const [tx, tz, th] of [[-7, -6, 19], [7, -6, 17], [-7, 6, 16], [7, 6, 20], [0, 0, 26]]) {
      const tw = new THREE.CylinderGeometry(1.9, 2.1, th, 8); tw.translate(tx, 12 + th / 2, tz); parts.push(prep(tw, stone));
      const tr = new THREE.ConeGeometry(2.5, 4.5, 8); tr.translate(tx, 12 + th + 2.25, tz); parts.push(prep(tr, roof));
    }
    const wall = new THREE.BoxGeometry(16, 6, 16); wall.translate(0, 15, 0); parts.push(prep(wall, stone));
    const castle = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    castle.position.set(cx, this.groundAt(cx, cz) - 3, cz);
    this.scene.add(castle);
    const lit = [];
    for (let k = 0; k < 14; k++) {
      const b = new THREE.BoxGeometry(0.7, 1.1, 0.2);
      b.translate(-3.5 + (k % 7) * 1.2, 16 + Math.floor(k / 7) * 4.5, 4.6);
      if (hash(k, 9) < 0.7) lit.push(prep(b, C('#ffc870').multiplyScalar(1.8)));
    }
    const litM = new THREE.Mesh(mergeGeometries(lit), new THREE.MeshBasicMaterial({ vertexColors: true }));
    litM.position.copy(castle.position);
    this.scene.add(litM);
  }

  buildIslands() {
    // a few far-off floating islands keep the sky magical
    const r = rng(5);
    this.islands = [];
    for (const [x, y, z, s] of [[-75, 44, -190, 18], [95, 52, -220, 22]]) {
      const g = makeIsland(s, Math.floor(r() * 1000), r);
      g.position.set(x, y, z);
      g.rotation.y = r() * TAU;
      g.userData = { y0: y, ph: r() * TAU, sp: 0.3 + r() * 0.3 };
      this.islands.push(g);
      this.scene.add(g);
    }
  }

  buildSmoke() {
    // chimney smoke: soft puffs drifting up and away
    const P = [], ph = [];
    const r = rng(61);
    for (const c of this.chimneys) for (let k = 0; k < 7; k++) { P.push(c.x, c.y, c.z); ph.push(k / 7 + r() * 0.05); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1));
    this.smokeU = { uT: { value: 0 } };
    this.smoke = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.smokeU, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uT; attribute float phase; varying float vA;
        void main() {
          float a = fract(uT * 0.12 + phase);
          vec3 p = position + vec3(a * 1.8 + sin(a * 6.0 + phase * 20.0) * 0.3, a * 4.5, -a * 0.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (90.0 + 260.0 * a) / -mv.z;
          vA = smoothstep(0.0, 0.15, a) * (1.0 - a) * 0.35;
        }`,
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)) * vA; gl_FragColor = vec4(vec3(0.86,0.8,0.86), a); }',
    }));
    this.smoke.frustumCulled = false;
    this.scene.add(this.smoke);
  }

  // ------------------------------------------------------------------ per frame
  update(t, post) {
    this.t = t;
    const { pos, quat } = this.camPose(t);
    this.camera.position.copy(pos);
    this.camera.quaternion.copy(quat);
    this.camera.updateMatrixWorld();
    this.skyU.uTime.value = t;
    this.sky.position.copy(pos);
    this.grassU.uT.value = t;
    this.flagU.uT.value = t;
    this.smokeU.uT.value = t;
    this.windmillSails.rotation.z = -t * 0.55;
    for (const g of this.islands) g.position.y = g.userData.y0 + Math.sin(t * g.userData.sp + g.userData.ph) * 0.6;
    for (const c of this.clouds) c.position.x = c.userData.x0 + t * c.userData.sp;
    this.moteU.uT.value = t;
    this.motes.position.set(0, 0, pos.z - 3);

    post.bloom = 0.7;
    post.bloomRadius = 0.5;
    post.bloomThreshold = 0.78;
    post.vignette = 0.34;
    post.grain = 0.03;
  }
}

// ---------------------------------------------------------------------- village kit
/** Non-indexed, uv-free geometry with a solid vertex colour (so everything can be merged). */
function prep(g, color) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const a of Object.keys(geo.attributes)) if (a !== 'position' && a !== 'normal') geo.deleteAttribute(a);
  const n = geo.attributes.position.count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([color.r, color.g, color.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}
function box(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return prep(g, color);
}
function cyl(r0, r1, h, seg, x, y, z, color) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  g.translate(x, y, z);
  return prep(g, color);
}

/** A timber-framed cottage. Local space: on the ground at the origin, front facing +z. */
function makeHouse(r, { w, d, h, rh, wall, roof }) {
  const solid = [], glow = [];
  const plaster = C(wall), timber = C('#4a3022'), stone = C('#8a8478'), roofC = C(roof), dark = C('#2c2a35');
  const lit = C('#ffc46a').multiplyScalar(1.7);
  solid.push(box(w + 0.18, 0.45, d + 0.18, 0, 0.225, 0, stone));
  solid.push(box(w, h, d, 0, 0.45 + h / 2, 0, plaster));
  const top = 0.45 + h;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.push(box(0.22, h, 0.22, sx * w / 2, 0.45 + h / 2, sz * d / 2, timber));
  for (const sz of [-1, 1]) {
    solid.push(box(w + 0.05, 0.18, 0.22, 0, 0.45 + h * 0.5, sz * d / 2, timber));
    solid.push(box(w + 0.05, 0.2, 0.24, 0, top, sz * d / 2, timber));
  }
  for (const sx of [-1, 1]) solid.push(box(0.22, 0.18, d + 0.05, sx * w / 2, 0.45 + h * 0.5, 0, timber));
  // braces on the front, upper storey
  for (const sx of [-1, 1]) solid.push(box(0.13, h * 0.55, 0.1, sx * w * 0.34, 0.45 + h * 0.76, d / 2 + 0.06, timber, 0, 0, sx * 0.55));
  // gable: plaster prism under the roof
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rh); shape.closePath();
  const gable = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  gable.rotateY(Math.PI / 2);
  gable.translate(-w / 2, top, 0);
  solid.push(prep(gable, plaster));
  // roof slabs: from the ridge down past the eaves, lifted by half their thickness
  const hyp = Math.hypot(d / 2, rh), slope = Math.atan2(rh, d / 2), over = 0.55, L = hyp + over;
  for (const sz of [-1, 1]) {
    const slab = new THREE.BoxGeometry(w + 0.9, 0.2, L);
    slab.rotateX(sz * slope);
    const zc = sz * Math.cos(slope) * (L / 2) + sz * Math.sin(slope) * 0.1;
    const yc = top + rh - Math.sin(slope) * (L / 2) + Math.cos(slope) * 0.1;
    slab.translate(0, yc, zc);
    solid.push(prep(slab, roofC.clone().multiplyScalar(0.9 + r() * 0.2)));
  }
  // ridge
  solid.push(box(w + 0.95, 0.22, 0.28, 0, top + rh + 0.12, 0, roofC.clone().multiplyScalar(0.7)));
  // chimney
  const chx = (r() < 0.5 ? -1 : 1) * w * 0.28;
  solid.push(box(0.62, 1.9, 0.62, chx, top + rh * 0.62, -d * 0.16, stone));
  const chimney = new THREE.Vector3(chx, top + rh * 0.62 + 1.0, -d * 0.16);
  // door with a little light above it
  const dx = (r() - 0.5) * w * 0.3;
  solid.push(box(1.05, 2.0, 0.14, dx, 0.45 + 1.0, d / 2 + 0.05, C('#5a3622')));
  solid.push(box(1.25, 0.14, 0.2, dx, 0.45 + 2.05, d / 2 + 0.08, timber));
  glow.push(box(0.18, 0.24, 0.18, dx + 0.75, 0.45 + 1.95, d / 2 + 0.15, lit));
  // windows: warm when lit, dusky glass when not
  const win = (x, y, z, ww, hh, rotY) => {
    const on = r() < 0.8;
    const g = box(ww, hh, 0.06, 0, 0, 0, on ? lit : C('#3b4a6a'));
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    (on ? glow : solid).push(g.applyMatrix4(mtx));
    for (const bar of [box(0.07, hh + 0.12, 0.08, 0, 0, 0.04, timber), box(ww + 0.12, 0.07, 0.08, 0, 0, 0.04, timber),
      box(ww + 0.2, 0.1, 0.14, 0, -hh / 2 - 0.05, 0.05, timber)]) solid.push(bar.applyMatrix4(mtx));
  };
  win(dx < 0 ? w * 0.27 : -w * 0.27, 0.45 + 1.5, d / 2 + 0.04, 0.85, 0.95, 0);
  win(dx < 0 ? w * 0.05 + 0.6 : -w * 0.05 - 0.6, 0.45 + h * 0.8, d / 2 + 0.04, 0.7, 0.75, 0);
  for (const sx of [-1, 1]) win(sx * (w / 2 + 0.04), 0.45 + 1.55, (r() - 0.5) * d * 0.4, 0.75, 0.85, sx * Math.PI / 2);
  // gable end windows (on the sides, under the roof triangle)
  for (const sx of [-1, 1]) if (r() < 0.7) win(sx * (w / 2 + 0.04), top + rh * 0.3, 0, 0.55, 0.6, sx * Math.PI / 2);
  return { solid, glow, chimney };
}

function makeLamp(side) {
  const iron = C('#2a2a33'), lit = C('#ffd08a').multiplyScalar(1.45);
  const solid = [cyl(0.06, 0.08, 2.7, 6, 0, 1.35, 0, iron), cyl(0.14, 0.18, 0.25, 6, 0, 0.12, 0, iron),
    box(0.55, 0.06, 0.06, -side * 0.24, 2.62, 0, iron), box(0.34, 0.06, 0.34, -side * 0.48, 2.55, 0, iron),
    box(0.3, 0.05, 0.3, -side * 0.48, 2.1, 0, iron)];
  const glow = [box(0.22, 0.38, 0.22, -side * 0.48, 2.32, 0, lit)];
  return { solid, glow, light: new THREE.Vector3(-side * 0.48, 2.32, 0) };
}
function makeFence() {
  const wood = C('#8a6a4a');
  return [box(0.1, 0.95, 0.1, 0, 0.47, 0, wood), box(0.06, 0.08, 1.45, 0, 0.75, -0.7, wood), box(0.06, 0.08, 1.45, 0, 0.4, -0.7, wood)];
}
function makeStall() {
  const wood = C('#8a5a3a'), out = [];
  out.push(box(2.6, 1.0, 1.1, 0, 0.5, 0, wood));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(box(0.1, 2.3, 0.1, sx * 1.25, 1.15, sz * 0.5, wood));
  for (let k = 0; k < 7; k++) out.push(box(2.9 / 7, 0.06, 1.7, -1.45 + (k + 0.5) * 2.9 / 7, 2.35, 0.25, C(k % 2 ? '#f4ede1' : '#c8473a'), -0.28, 0, 0));
  // produce on the counter
  const fruit = ['#e2463a', '#ffb347', '#7ac05a', '#ffd34a'];
  for (let k = 0; k < 10; k++) {
    const g = new THREE.IcosahedronGeometry(0.11, 0);
    g.translate(-1.0 + (k % 5) * 0.5, 1.1, -0.2 + Math.floor(k / 5) * 0.35);
    out.push(prep(g, C(fruit[k % 4])));
  }
  return out;
}
function makeWell() {
  const stoneC = C('#8f8a80'), wood = C('#6b4a32'), out = [];
  const ring = new THREE.CylinderGeometry(1.0, 1.05, 0.9, 10, 1, true);
  ring.translate(0, 0.45, 0);
  out.push(prep(ring, stoneC));
  out.push(cyl(1.12, 1.12, 0.14, 10, 0, 0.92, 0, stoneC));
  out.push(cyl(0.95, 0.95, 0.05, 10, 0, 0.6, 0, C('#2a3c55')));
  for (const sx of [-1, 1]) out.push(box(0.14, 2.0, 0.14, sx * 0.95, 1.4, 0, wood));
  out.push(box(2.3, 0.1, 0.12, 0, 2.3, 0, wood));
  const shape = new THREE.Shape(); shape.moveTo(-0.9, 0); shape.lineTo(0.9, 0); shape.lineTo(0, 0.7); shape.closePath();
  const roofG = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: false });
  roofG.rotateY(Math.PI / 2);
  roofG.translate(-1.25, 2.38, 0);
  out.push(prep(roofG, C('#9a3f4f')));
  return out;
}
function makeCart() {
  const wood = C('#7a5233'), out = [];
  out.push(box(1.5, 0.45, 2.3, 0, 0.75, 0, wood));
  for (const sx of [-1, 1]) {
    const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(sx * 0.82, 0.42, 0.2);
    out.push(prep(wheel, C('#4a3022')));
  }
  out.push(box(0.08, 0.08, 1.6, 0.35, 0.6, 1.85, wood));
  out.push(box(0.08, 0.08, 1.6, -0.35, 0.6, 1.85, wood));
  for (let k = 0; k < 4; k++) out.push(box(0.4, 0.3, 0.4, -0.3 + (k % 2) * 0.55, 1.12, -0.6 + Math.floor(k / 2) * 0.6, C('#c49a5a')));
  return out;
}
function makeBarrel() {
  const out = [];
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.85, 9);
  g.translate(0, 0.425, 0);
  out.push(prep(g, C('#8a5a36')));
  for (const y of [0.15, 0.7]) out.push(cyl(0.355, 0.355, 0.06, 9, 0, y, 0, C('#3a3036')));
  return out;
}
function makeCrate(r) {
  const s = 0.5 + r() * 0.25;
  return [box(s, s, s, 0, s / 2, 0, C('#b08a58')), box(s + 0.02, 0.06, s + 0.02, 0, s * 0.85, 0, C('#7a5a3a'))];
}
function makeBannerPole() {
  return [cyl(0.05, 0.06, 4.2, 6, 0, 2.1, 0, C('#5a4030')), cyl(0.09, 0.09, 0.1, 6, 0, 4.2, 0, C('#ffd9a0'))];
}
function makeTree(r) {
  const out = [];
  const h = 1.6 + r() * 1.3;
  out.push(cyl(0.16, 0.24, h, 6, 0, h / 2, 0, C('#5a3a2a')));
  const greens = ['#3f8a4a', '#4f9a52', '#2f7a44', '#5aa456'];
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const rad = 1.1 + r() * 1.1;
    const g = new THREE.IcosahedronGeometry(rad, 0);
    g.translate((r() - 0.5) * 1.2, h + rad * 0.7 + r() * 0.8, (r() - 0.5) * 1.2);
    out.push(prep(g, C(greens[Math.floor(r() * greens.length)])));
  }
  return out;
}
function makePine(r) {
  const out = [];
  const h = 3.5 + r() * 3.5;
  out.push(cyl(0.14, 0.2, h * 0.35, 6, 0, h * 0.175, 0, C('#4a3022')));
  for (let k = 0; k < 3; k++) {
    const g = new THREE.ConeGeometry(1.5 - k * 0.38, h * 0.42, 7);
    g.translate(0, h * 0.3 + k * h * 0.22 + h * 0.21, 0);
    out.push(prep(g, C(k % 2 ? '#2f6e4c' : '#285f45').multiplyScalar(0.9 + r() * 0.2)));
  }
  return out;
}

// ---------------------------------------------------------------------- helpers
function lookQuat(from, to) {
  const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function jitter(geo, amt, seed) {
  const r = rng(seed);
  const p = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [(r() - 0.5) * amt, (r() - 0.5) * amt * 0.6, (r() - 0.5) * amt]);
    const [dx, dy, dz] = seen.get(key);
    p.setXYZ(i, p.getX(i) + dx, p.getY(i) + dy, p.getZ(i) + dz);
  }
  geo.computeVertexNormals();
}

function paint(geo, fn) {
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = fn(v, i);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

function makeIsland(s, seed, r) {
  const g = new THREE.Group();
  const top = new THREE.CylinderGeometry(s, s * 0.88, s * 0.32, 10, 1);
  jitter(top, s * 0.12, seed);
  paint(top, (p) => (p.y > 0 ? C('#3aa58c').lerp(C('#78c9a0'), r() * 0.5) : C('#7a5a6e')));
  const parts = [top];
  // an uneven rocky underside: a main cone and a few hanging lobes
  const lobes = 3 + Math.floor(r() * 3);
  for (let k = 0; k <= lobes; k++) {
    const main = k === 0;
    const rad = main ? s * 0.9 : s * (0.25 + r() * 0.3);
    const h = main ? s * (1.1 + r() * 0.5) : s * (0.6 + r() * 0.6);
    const a = r() * TAU, d = main ? 0 : s * (0.35 + r() * 0.3);
    const cone = new THREE.ConeGeometry(rad, h, main ? 10 : 6, main ? 3 : 2);
    cone.rotateX(Math.PI);
    cone.translate(Math.cos(a) * d, -s * 0.12 - h / 2, Math.sin(a) * d);
    jitter(cone, rad * 0.25, seed + 1 + k);
    paint(cone, (p) => C('#a07a8a').lerp(C('#4a3266'), clamp(-p.y / (s * 1.4))).lerp(C('#c98f7a'), 0.15 * r()));
    parts.push(cone);
  }
  const nTrees = 2 + Math.floor(r() * 4);
  for (let i = 0; i < nTrees; i++) {
    const a = r() * TAU, d = r() * s * 0.6;
    const h = s * (0.35 + r() * 0.3);
    const cone = new THREE.ConeGeometry(s * 0.14, h, 6);
    cone.translate(Math.cos(a) * d, s * 0.16 + h / 2 + s * 0.08, Math.sin(a) * d);
    paint(cone, () => C('#1f7a6a').lerp(C('#2fa58a'), r()));
    const trunk = new THREE.CylinderGeometry(s * 0.03, s * 0.04, s * 0.12, 5);
    trunk.translate(Math.cos(a) * d, s * 0.16 + s * 0.05, Math.sin(a) * d);
    paint(trunk, () => C('#5a3a3a'));
    parts.push(cone, trunk);
  }
  const geo = mergeGeometries(parts.map((p) => p.toNonIndexed ? p.toNonIndexed() : p));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  g.add(mesh);
  if (s > 5 && r() < 0.6) {
    // a waterfall pouring off the edge
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.12, s * 2.6), new THREE.MeshBasicMaterial({ color: C('#d8fbff'), transparent: true, opacity: 0.75, depthWrite: false }));
    const a = r() * TAU;
    fall.position.set(Math.cos(a) * s * 0.92, -s * 1.15, Math.sin(a) * s * 0.92);
    fall.rotation.y = -a + Math.PI / 2;
    g.add(fall);
  }
  if (r() < 0.6) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.12, 0), new THREE.MeshBasicMaterial({ color: C('#7ff0ff').multiplyScalar(1.8) }));
    crystal.scale.y = 1.8;
    crystal.position.set(0, -s * 1.9, 0);
    g.add(crystal);
  }
  return g;
}
