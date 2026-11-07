// Inside the cable. One curved tube whose wall is made of twisted, glowing strands (relief and shading
// are procedural), light pulses racing along the strands, pixel "data packets" streaking past, the cut
// cable end seen face-on for the dive in, and a white light at the far end that bursts into the world.
// The trip out replays the same tube backwards.
import * as THREE from 'three';
import { IN, OUT } from './timeline.js';
import { clamp, lerp, smoothstep, easeInCubic, easeOutCubic, invLerp, rng, easeInOutSine } from './util.js';

const R = 1.0; // inner radius
const STRANDS = 10;
const PALETTE = ['#1d96a0', '#0f5a62', '#22d3ee', '#1d96a0', '#d6cfc2', '#0f5a62', '#8a6ae0', '#1d96a0', '#22d3ee', '#0f5a62'];

export class Tunnel {
  constructor(W, H) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(68, W / H, 0.01, 500);

    // Path: straight for the first 6 units (the cable end faces +z), then a long gently winding run.
    const r = rng(42);
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, -6)];
    let p = new THREE.Vector3(0, 0, -6);
    for (let i = 0; i < 16; i++) {
      p = p.clone().add(new THREE.Vector3((r() - 0.5) * 7, (r() - 0.5) * 5, -7.5));
      pts.push(p);
    }
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.len = this.curve.getLength();
    this.frames = this.curve.computeFrenetFrames(1200, false);

    this.uniforms = {
      uTime: { value: 0 },
      uLen: { value: this.len },
      uTwist: { value: 0.11 },
      uEnd: { value: 0 },
      uCamS: { value: 0 },
      uColors: { value: PALETTE.map((c) => new THREE.Color(c)) },
    };
    const tube = new THREE.TubeGeometry(this.curve, 1400, R, 72, false);
    const wall = new THREE.Mesh(tube, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        uniform float uLen, uTwist;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vBulge;
        const float K = ${STRANDS}.0;
        void main() {
          vUv = uv;
          float s = uv.x * uLen;
          float ph = uv.y * K + s * uTwist;
          float f = fract(ph);
          float bulge = sin(f * 3.14159265);
          vBulge = bulge;
          vec3 p = position - normal * (pow(bulge, 0.6) * 0.11);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLen, uTwist, uEnd, uCamS;
        uniform vec3 uColors[${STRANDS}];
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vBulge;
        const float K = ${STRANDS}.0;
        float h1(float n) { return fract(sin(n * 91.345) * 43758.5453); }
        void main() {
          float s = vUv.x * uLen;
          float ph = vUv.y * K + s * uTwist;
          float idx = floor(ph);
          float f = fract(ph);
          int ci = int(mod(idx, K));
          vec3 base = uColors[0];
          for (int i = 0; i < ${STRANDS}; i++) if (i == ci) base = uColors[i];
          float b = vBulge;
          // fake round-strand lighting + specular ridge
          float diff = 0.18 + 0.82 * pow(b, 1.4);
          float spec = pow(b, 26.0) * 0.9;
          // twisted fibres inside each strand
          float fib = 0.75 + 0.25 * sin((f * 9.0 + s * 3.2) * 3.14159);
          vec3 col = base * diff * fib * 0.24 + vec3(spec) * 0.16;
          // light pulses racing forward along each strand
          float lane = mod(idx, K);
          float q = s * 0.11 - uTime * 2.6 + h1(lane) * 7.0;
          float pulse = pow(max(0.0, sin(q * 3.14159)), 40.0);
          float q2 = s * 0.37 - uTime * 4.2 + h1(lane + 3.0) * 5.0;
          float spark = pow(max(0.0, sin(q2 * 3.14159)), 90.0);
          vec3 pc = mix(vec3(1.0, 0.85, 0.63), vec3(0.75, 1.0, 1.0), step(0.5, h1(lane + 9.0)));
          col += (base * 0.6 + pc * 0.9) * (pulse * 1.5 + spark * 1.1) * smoothstep(0.15, 0.6, b);
          // pixel data: little square cells lighting up on the strands
          vec2 cell = floor(vec2(s * 5.0, vUv.y * 140.0));
          float on = step(0.985, h1(cell.x * 13.1 + cell.y * 7.7 + floor(uTime * 12.0)));
          col += on * vec3(1.0, 0.95, 0.85) * 0.75 * smoothstep(0.4, 0.9, b);
          // groove shadow
          col *= smoothstep(0.0, 0.18, b);
          // depth: fade with distance from the camera (black far away) ...
          float d = abs(s - uCamS);
          col *= exp(-max(0.0, d - 1.0) * 0.13);
          // ... except the far end, which glows white
          float endGlow = smoothstep(uLen - 30.0, uLen - 1.0, s) * uEnd;
          col = mix(col, vec3(1.0, 0.97, 0.9), endGlow * endGlow);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    this.scene.add(wall);

    // The far end: a blinding disc of light.
    const endP = this.curve.getPointAt(1), endT = this.curve.getTangentAt(1);
    this.endLight = new THREE.Mesh(new THREE.CircleGeometry(R * 1.05, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.endLight.position.copy(endP);
    this.endLight.lookAt(endP.clone().sub(endT));
    this.scene.add(this.endLight);

    // The cut cable end, face-on, for the dive in: jacket, braid, insulation rings.
    this.endCap = new THREE.Group();
    const ring = (r0, r1, color, emissive = 0) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96, 1), new THREE.MeshBasicMaterial({ color }));
      m.material.color.multiplyScalar(1 + emissive);
      return m;
    };
    this.endCap.add(ring(R * 1.0, R * 1.07, '#f4ede1', 0.0)); // inner insulation (cream)
    this.endCap.add(ring(R * 1.07, R * 1.10, '#ffd9a0', 0.4)); // bright peach line
    const braid = new THREE.Mesh(new THREE.RingGeometry(R * 1.10, R * 1.32, 128, 1), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          float a = atan(vP.y, vP.x) * 30.0;
          float r = length(vP) * 40.0;
          float x = sin(a + r) * sin(a - r);
          vec3 c = mix(vec3(0.04, 0.24, 0.26), vec3(0.45, 0.85, 0.85), smoothstep(0.2, 0.9, x));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }));
    this.endCap.add(braid);
    this.endCap.add(ring(R * 1.32, R * 1.36, '#22d3ee', 0.2));
    this.endCap.add(ring(R * 1.36, R * 1.78, '#16171b', 0)); // rubber jacket face
    this.endCap.add(ring(R * 1.78, R * 1.80, '#3a3d44', 0)); // jacket edge highlight
    // jacket body running back into the dark
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 1.8, R * 1.8, 30, 96, 1, true),
      new THREE.ShaderMaterial({
        side: THREE.FrontSide,
        vertexShader: 'varying vec3 vN; varying float vY; void main(){ vN = normalize(normalMatrix*normal); vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vN; varying float vY; void main(){ float rim = pow(1.0 - abs(vN.z), 2.0); float band = 0.5 + 0.5 * sin(vY * 2.0); vec3 c = vec3(0.035,0.04,0.045) + vec3(0.13,0.55,0.6) * rim * (0.7 + 0.3 * band) * smoothstep(-15.0, 13.0, vY) + vec3(0.25) * pow(max(0.0, vN.y), 8.0) * smoothstep(-15.0, 13.0, vY); gl_FragColor = vec4(c,1.0); }',
      }),
    );
    jacket.rotation.x = Math.PI / 2;
    jacket.position.z = -15;
    this.endCap.add(jacket);
    this.scene.add(this.endCap);

    // Data packets: little glowing pixels streaking along the cable.
    const N = 260;
    this.packets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      N,
    );
    this.packetData = [];
    const pr = rng(7);
    const pcols = ['#ffffff', '#ffd9a0', '#22d3ee', '#f4ede1', '#1d96a0'];
    for (let i = 0; i < N; i++) {
      const c = new THREE.Color(pcols[Math.floor(pr() * pcols.length)]).multiplyScalar(1.4 + pr() * 1.2);
      this.packets.setColorAt(i, c);
      this.packetData.push({
        s0: pr() * this.len, speed: 6 + pr() * 18, ang: pr() * Math.PI * 2, rad: 0.25 + pr() * 0.55,
        size: 0.018 + pr() * 0.03, spin: (pr() - 0.5) * 1.5,
      });
    }
    this.packets.frustumCulled = false;
    this.scene.add(this.packets);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
  }

  frameAt(s) {
    const u = clamp(s / this.len, 0, 1);
    const i = Math.min(this.frames.tangents.length - 1, Math.round(u * (this.frames.tangents.length - 1)));
    return { p: this.curve.getPointAt(u), t: this.curve.getTangentAt(u), n: this.frames.normals[i], b: this.frames.binormals[i] };
  }

  /** Camera arc length s along the tube at time t (negative = outside, in front of the cable end). */
  camS(t) {
    if (t < OUT.flash) {
      const [a0, a1] = IN.approach;
      if (t < a1) {
        const v = invLerp(a0, a1, t);
        const u = v * v * (0.55 + 0.45 * v);
        // geometric zoom from far away to just inside the mouth
        const d = Math.pow(70, 1 - u) * Math.pow(0.6, u);
        return -(d - 0.6) + 0.0;
      }
      const u = invLerp(IN.tunnel[0], IN.tunnel[1], t);
      return lerp(0.0, this.len - 1.2, Math.pow(u, 1.9) * 0.82 + u * 0.18);
    }
    // way out: backwards from near the far end to the mouth, then out and away
    if (t < OUT.recede[0]) {
      const u = invLerp(OUT.tunnel[0], OUT.tunnel[1], t);
      return lerp(this.len - 2.0, 0.0, 1 - Math.pow(1 - u, 1.7));
    }
    const u = easeInCubic(invLerp(OUT.recede[0], OUT.recede[1], t));
    const d = Math.pow(0.6, 1 - u) * Math.pow(140, u);
    return -(d - 0.6);
  }

  update(t, post) {
    const s = this.camS(t);
    this.uniforms.uTime.value = t;
    this.uniforms.uCamS.value = s;
    const goingIn = t < OUT.flash;
    // far-end glow only near the end of the trip in, and at the start of the trip out
    this.uniforms.uEnd.value = goingIn ? smoothstep(IN.tunnel[1] - 0.55, IN.tunnel[1], t) : 1 - smoothstep(OUT.tunnel[0], OUT.tunnel[0] + 0.6, t);
    this.endLight.visible = true;

    const cam = this.camera;
    if (s < 0.4) {
      // outside / at the mouth: come in from slightly off-axis (so the cable's body shows), straighten up
      const d = 0.4 - s;
      const off = Math.min(1, d / 40);
      cam.position.set(d * 0.22 * off, d * 0.30 * off, 0.4 - s - 0.4);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, -6);
    } else {
      const f = this.frameAt(s);
      const ahead = this.frameAt(Math.min(this.len, s + 2.5));
      cam.position.copy(f.p);
      // roll: a slow corkscrew while travelling
      const rollAmt = 1.3 * smoothstep(0.4, this.len, s);
      const up = f.n.clone().multiplyScalar(Math.cos(rollAmt)).add(f.b.clone().multiplyScalar(Math.sin(rollAmt)));
      // blend from world-up at the mouth to the frame's normal inside
      const k = smoothstep(0.4, 4, s);
      cam.up.copy(new THREE.Vector3(0, 1, 0).lerp(up, k).normalize());
      cam.lookAt(ahead.p);
    }
    // a touch of FOV breathing with speed
    const speed = Math.abs(this.camS(t + 1 / 60) - this.camS(t - 1 / 60)) * 30;
    cam.fov = 66 + clamp(speed / 60, 0, 1) * 14;
    cam.updateProjectionMatrix();

    // packets: drift forward along the tube; stretched along the direction of travel by the relative speed
    const rel = goingIn ? 1 : -1;
    for (let i = 0; i < this.packetData.length; i++) {
      const d = this.packetData[i];
      let ps = (d.s0 + d.speed * t * rel) % this.len;
      if (ps < 0) ps += this.len;
      const f = this.frameAt(ps);
      const a = d.ang + d.spin * t;
      const pos = f.p.clone().add(f.n.clone().multiplyScalar(Math.cos(a) * d.rad)).add(f.b.clone().multiplyScalar(Math.sin(a) * d.rad));
      const stretch = 1 + Math.abs(speed - d.speed * rel) * 0.045;
      // from outside the cable only the packets near the mouth can be seen
      const vis = s < 0.4 ? (ps < 7 ? 1 : 0) : 1;
      this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.t);
      this._m.compose(pos, this._q, new THREE.Vector3(d.size * vis, d.size * vis, d.size * stretch * 3 * vis));
      this.packets.setMatrixAt(i, this._m);
    }
    this.packets.instanceMatrix.needsUpdate = true;

    // post: speed blur + aberration, bloom high
    const blur = clamp(speed / 70, 0, 1);
    post.radial = 0.2 + 0.8 * blur;
    post.ca = 0.15 + 0.45 * blur;
    post.bloom = 0.85;
    post.bloomRadius = 0.45;
    post.bloomThreshold = 0.62;
    post.vignette = 0.55;
    post.grain = 0.02;
    post.speed = speed;
  }
}
