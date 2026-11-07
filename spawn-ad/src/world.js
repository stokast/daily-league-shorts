// The game world: you spawn on a glowing pad at dusk and drift forward, looking slightly up.
// Low-poly and flat-shaded, in Spawn's colours: indigo-to-peach sky, teal land, peach/teal light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W0, OUT } from './timeline.js';
import { clamp, lerp, smoothstep, invLerp, easeOutCubic, easeInOutCubic, easeInCubic, rng, fbm, TAU } from './util.js';

const C = (hex) => new THREE.Color(hex); // sRGB hex -> linear working colour
const SUN_DIR = new THREE.Vector3(-0.32, 0.075, -1).normalize();

export const CAM_SETTLE = W0 + 1.7; // camera has finished its spawn-in move
const CAM_SPEED = 0.85;

export class World {
  constructor(W, H) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 3000);
    this.scene.fog = new THREE.Fog(C('#e7a08f'), 60, 520);
    this.t = 0;
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildMountains();
    this.buildIslands();
    this.buildClouds();
    this.buildPad();
    this.buildCollectibles();
    this.buildMotes();
  }

  // ------------------------------------------------------------------ camera
  /** Camera pose at time t (also used to place the title screens). */
  camPose(t) {
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const P0 = new THREE.Vector3(0, 2.1, 4.3);
    const P1 = new THREE.Vector3(0, 2.6, -0.3);
    const qDown = lookQuat(P0, new THREE.Vector3(0, 0.5, -1.8));
    const fwd = (tt) => {
      const u = tt - CAM_SETTLE;
      return new THREE.Vector3(
        0.35 * Math.sin(u * 0.33) - 0.1 * u * 0.0,
        P1.y + 0.07 * u,
        P1.z - CAM_SPEED * u,
      );
    };
    const fwdQuat = (tt) => {
      const u = tt - CAM_SETTLE;
      const e = new THREE.Euler(
        THREE.MathUtils.degToRad(8.5 + 0.6 * Math.sin(u * 0.41)),
        THREE.MathUtils.degToRad(1.6 * Math.sin(u * 0.27 + 0.6)),
        THREE.MathUtils.degToRad(0.9 * Math.sin(u * 0.36 + 1.1)),
        'YXZ',
      );
      return new THREE.Quaternion().setFromEuler(e);
    };
    if (t < CAM_SETTLE) {
      const u = easeInOutCubic(invLerp(W0, CAM_SETTLE, t));
      // rise up off the pad while tilting from the pad to the horizon
      const p1 = fwd(CAM_SETTLE);
      pos.set(lerp(P0.x, p1.x, u), lerp(P0.y, p1.y, easeOutCubic(invLerp(W0, CAM_SETTLE, t))), lerp(P0.z, p1.z, u));
      quat.copy(qDown).slerp(fwdQuat(CAM_SETTLE), u);
    } else {
      pos.copy(fwd(t));
      quat.copy(fwdQuat(t));
      // the vortex: lunge forward as everything is pulled in
      const v = easeInCubic(invLerp(OUT.vortex[0], OUT.vortex[1], t));
      if (v > 0) pos.add(new THREE.Vector3(0, 0, -1).applyQuaternion(quat).multiplyScalar(v * 3));
    }
    return { pos, quat };
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

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(C('#9a86e8'), C('#1b5a5c'), 1.25));
    const key = new THREE.DirectionalLight(C('#ffc9a3'), 2.0);
    key.position.set(-0.55, 0.45, 0.75).multiplyScalar(100);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(C('#ff9fb0'), 0.9);
    rim.position.copy(SUN_DIR).multiplyScalar(100);
    this.scene.add(rim);
  }

  // ------------------------------------------------------------------ land
  height(x, z) {
    const r = Math.hypot(x, z + 10);
    const path = Math.abs(x + 0.8 * Math.sin(z * 0.05));
    let h = fbm(x * 0.035, z * 0.035, 3) * 2.2;
    h += Math.max(0, fbm(x * 0.009 + 3, z * 0.009 - 2, 4)) * 70 * smoothstep(45, 260, r);
    h += smoothstep(30, 120, path) * 6;
    h *= 0.35 + 0.65 * smoothstep(3, 16, path);
    h -= 0.6 * Math.exp(-(x * x + z * z) / 60); // a shallow bowl around the spawn pad
    return h;
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(900, 900, 150, 150);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -250);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const lo = C('#1d7468'), mid = C('#33a084'), hi = C('#73c99c'), rock = C('#6a5690'), snow = C('#f2d6d0');
    const c = new THREE.Color();
    const r = rng(9);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.08, z * 0.08, 2);
      c.copy(lo).lerp(mid, clamp(0.5 + n * 0.8 + h * 0.08));
      c.lerp(hi, clamp(n * 0.6));
      c.lerp(rock, smoothstep(14, 40, h));
      c.lerp(snow, smoothstep(48, 70, h));
      c.multiplyScalar(0.92 + r() * 0.16);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // level-editor grid: revealed by the spawn shockwave, then stays faint
    this.gridU = { uGridT: { value: 0 }, uGridBase: { value: 0.0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGridT = this.gridU.uGridT;
      sh.uniforms.uGridBase = this.gridU.uGridBase;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uGridT, uGridBase;')
        .replace('#include <dithering_fragment>', /* glsl */ `
          {
            vec2 g = abs(fract(vWPos.xz / 2.0 - 0.5) - 0.5) / fwidth(vWPos.xz / 2.0);
            float line = 1.0 - min(min(g.x, g.y), 1.0);
            float r = length(vWPos.xz);
            float wave = exp(-pow((r - uGridT * 38.0) / 3.0, 2.0)) * step(0.001, uGridT);
            float behind = smoothstep(uGridT * 38.0, uGridT * 38.0 - 10.0, r);
            float fade = exp(-r * 0.035);
            float waveA = exp(-uGridT * 0.9);
            float a = line * (uGridBase * fade + wave * 1.4 * waveA + behind * 0.12 * fade * step(0.001, uGridT));
            gl_FragColor.rgb += vec3(0.13, 0.83, 0.93) * a;
            gl_FragColor.rgb += vec3(0.13, 0.83, 0.93) * wave * 0.25 * waveA;
          }
          #include <dithering_fragment>`);
    };
    this.terrain = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrain);
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

  // ------------------------------------------------------------------ sky stuff
  buildIslands() {
    const r = rng(5);
    this.islands = [];
    const spots = [
      [-24, 13, -62, 7], [27, 22, -90, 11], [-70, 40, -170, 22], [48, 9, -48, 4], [6, 50, -190, 16],
      [-14, 34, -98, 6], [90, 48, -200, 24], [-92, 20, -110, 10], [30, 62, -130, 8], [-34, 8, -36, 3],
      [14, 16, -40, 2.5], [-6, 26, -60, 3.5],
    ];
    for (const [x, y, z, s] of spots) {
      const g = makeIsland(s, Math.floor(r() * 1000), r);
      g.position.set(x, y, z);
      g.rotation.y = r() * TAU;
      g.userData = { y0: y, ph: r() * TAU, sp: 0.3 + r() * 0.3 };
      this.islands.push(g);
      this.scene.add(g);
    }
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

  // ------------------------------------------------------------------ the spawn pad
  buildPad() {
    const pad = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.28, 8), new THREE.MeshLambertMaterial({ color: C('#2b2648'), flatShading: true }));
    base.position.y = 0.0;
    pad.add(base);
    const ringMat = (hex) => new THREE.MeshBasicMaterial({ color: C(hex).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.padRings = [
      new THREE.Mesh(new THREE.RingGeometry(1.15, 1.28, 64), ringMat('#22d3ee')),
      new THREE.Mesh(new THREE.RingGeometry(1.45, 1.52, 64), ringMat('#ffd9a0')),
      new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 64), ringMat('#ffffff')),
    ];
    for (const m of this.padRings) { m.rotation.x = -Math.PI / 2; m.position.y = 0.15; pad.add(m); }
    // the spawn beam
    this.beamU = { uT: { value: 0 }, uA: { value: 0 } };
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 40, 32, 1, true), new THREE.ShaderMaterial({
      uniforms: this.beamU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uT, uA; varying vec2 vUv;
        void main() {
          float y = vUv.y;
          float stripes = 0.65 + 0.35 * sin((y * 60.0 - uT * 18.0));
          float a = uA * pow(1.0 - y, 2.2) * stripes * smoothstep(0.0, 0.06, y);
          gl_FragColor = vec4(vec3(0.55, 0.95, 1.0) * a + vec3(1.0, 0.85, 0.63) * a * 0.4, 1.0);
        }
      `,
    }));
    this.beam.position.y = 20;
    pad.add(this.beam);
    // shockwave ring along the ground
    this.shock = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 96), new THREE.MeshBasicMaterial({ color: C('#7ff0ff').multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.y = 0.2;
    pad.add(this.shock);
    // pixel burst
    const N = 140;
    this.burst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    const r = rng(12);
    this.burstData = [];
    const cols = ['#ffffff', '#ffd9a0', '#22d3ee', '#7ff0ff'];
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, sp = 1.5 + r() * 4.5;
      const rr = 0.3 + r() * 1.1;
      this.burstData.push({ x0: Math.cos(a) * rr, z0: Math.sin(a) * rr, vx: Math.cos(a) * sp * 0.55, vz: Math.sin(a) * sp * 0.55, vy: 2.5 + r() * 6, s: 0.05 + r() * 0.07, delay: r() * 0.15 });
      this.burst.setColorAt(i, C(cols[i % cols.length]).multiplyScalar(1.5));
    }
    this.burst.frustumCulled = false;
    pad.add(this.burst);
    pad.position.set(0, this.height(0, 0) + 0.12, 0);
    this.pad = pad;
    this.scene.add(pad);
  }

  buildCollectibles() {
    // coin trails arcing along both sides of the path, a few gems
    const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 24);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: C('#ffc94a'), emissive: C('#b37400'), emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.3 });
    this.coins = [];
    for (const side of []) {
      for (let i = 0; i < 14; i++) {
        const z = -3 - i * 1.35 - (side > 0 ? 0.6 : 0);
        const m = new THREE.Mesh(coinGeo, coinMat);
        m.position.set(side * (2.4 + 0.5 * Math.sin(i * 0.5)), 2.0 + 0.9 * Math.sin(i * 0.45 + (side > 0 ? 1 : 0)), z);
        m.userData.ph = i * 0.4;
        this.coins.push(m);
        this.scene.add(m);
      }
    }
    const gemMat = new THREE.MeshStandardMaterial({ color: C('#5ff2ff'), emissive: C('#1aa8c0'), emissiveIntensity: 1.2, metalness: 0.1, roughness: 0.15, flatShading: true });
    this.gems = [];
    const r = rng(3);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), gemMat);
      g.scale.y = 1.5;
      g.position.set((r() < 0.5 ? -1 : 1) * (5 + r() * 7), 4 + r() * 7, -8 - r() * 34);
      g.userData.ph = r() * TAU;
      this.gems.push(g);
      this.scene.add(g);
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

  // ------------------------------------------------------------------ per frame
  update(t, post) {
    this.t = t;
    const { pos, quat } = this.camPose(t);
    this.camera.position.copy(pos);
    this.camera.quaternion.copy(quat);
    this.camera.updateMatrixWorld();
    this.skyU.uTime.value = t;
    this.sky.position.copy(pos);

    // spawn moment
    const st = t - W0;
    this.beamU.uT.value = t;
    this.beamU.uA.value = 0;
    this.beam.visible = false;
    const sw = clamp(st / 1.1);
    this.shock.scale.setScalar(1 + easeOutCubic(sw) * 26);
    this.shock.material.opacity = (1 - sw) * 0.9;
    this.shock.visible = sw < 1;
    this.gridU.uGridT.value = st > 0 ? Math.min(st * 0.9, 12) : 0;
    this.gridU.uGridBase.value = 0.035;
    const ringPulse = 0.75 + 0.25 * Math.sin(t * 4);
    this.padRings.forEach((m, i) => { m.material.opacity = ringPulse * (i === 2 ? 0.8 : 1); m.rotation.z = t * (i % 2 ? -0.4 : 0.3); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
    for (let i = 0; i < this.burstData.length; i++) {
      const d = this.burstData[i];
      const tt = Math.max(0, st - d.delay);
      const life = clamp(1 - tt / 1.6);
      pp.set(d.x0 + d.vx * tt, 0.3 + d.vy * tt - 4.5 * tt * tt, d.z0 + d.vz * tt);
      if (pp.y < 0.1) pp.y = 0.1;
      q.setFromEuler(new THREE.Euler(tt * 3 + i, tt * 2, 0));
      sc.setScalar(st > d.delay ? d.s * life : 0);
      m4.compose(pp, q, sc);
      this.burst.setMatrixAt(i, m4);
    }
    this.burst.instanceMatrix.needsUpdate = true;

    for (const g of this.islands) g.position.y = g.userData.y0 + Math.sin(t * g.userData.sp + g.userData.ph) * 0.6;
    for (const c of this.clouds) c.position.x = c.userData.x0 + t * c.userData.sp;
    for (const c of this.coins) { c.rotation.y = t * 2.6 + c.userData.ph; c.position.y += Math.sin(t * 2 + c.userData.ph) * 0.002; }
    for (const g of this.gems) { g.rotation.y = t * 1.4 + g.userData.ph; g.position.y += Math.sin(t * 1.7 + g.userData.ph) * 0.003; }
    this.moteU.uT.value = t;

    post.bloom = 0.7;
    post.bloomRadius = 0.5;
    post.bloomThreshold = 0.78;
    post.vignette = 0.32;
    post.grain = 0.03;
  }
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
