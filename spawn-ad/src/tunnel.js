// The cable. On enter its cut end glows open behind the typed words; the words become 3D letters that
// are sucked into the mouth (stretched toward it, tumbling, trailing light) and fly on down the tube, and
// the camera dives in after them. Inside: a curved tube whose wall is twisted glowing strands, light
// pulses, pixel "data packets", and a white light at the far end that bursts into the world.
// The trip out replays the same tube backwards.
import * as THREE from 'three';
import { IN, OUT, OPEN } from './timeline.js';
import { clamp, lerp, smoothstep, easeInCubic, easeOutCubic, invLerp, rng, easeInOutSine, hash } from './util.js';

const R = 1.0; // inner radius
const STRANDS = 10;
const PALETTE = ['#1d96a0', '#0f5a62', '#22d3ee', '#1d96a0', '#d6cfc2', '#0f5a62', '#8a6ae0', '#1d96a0', '#22d3ee', '#0f5a62'];

export class Tunnel {
  constructor(W, H) {
    this.W = W; this.H = H;
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
          float d = abs(s - max(uCamS, 0.0));
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

    // a glow inside the mouth that flares as the letters go in
    this.mouthU = { uA: { value: 0 } };
    this.mouthGlow = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2), new THREE.ShaderMaterial({
      uniforms: this.mouthU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = (exp(-r*r*9.0) + 0.35*exp(-r*r*2.5)) * uA; gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * a, 1.0); }',
    }));
    this.mouthGlow.position.set(0, 0, -0.7);
    this.scene.add(this.mouthGlow);

    this.buildSuction();
    this.buildLetters();
  }

  // ------------------------------------------------------------------ the words, sucked in
  buildLetters() {
    const { W, H } = this;
    const s = W / 1080;
    const px = 76 * s; // must match the overlay's opening line
    const text = OPEN.text;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${px}px "Geist Pixel"`;
    const wText = mc.measureText(text).width;
    const cw = 0.42 * px, ch = 0.95 * px, gap = 0.09 * px;
    const x0 = W / 2 - (wText + gap + cw) / 2;
    const base = H / 2 + 0.3 * px;
    // glyph atlas (drawn big, with a soft glow)
    const F = 140, pad = 26;
    const items = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue;
      items.push({ ch: text[i], left: x0 + mc.measureText(text.slice(0, i)).width });
    }
    items.push({ cursor: true, left: x0 + wText + gap });
    const ac = document.createElement('canvas').getContext('2d');
    ac.font = `${F}px "Geist Pixel"`;
    let ax = 0;
    for (const it of items) {
      it.aw = Math.ceil((it.cursor ? 0.42 * F : ac.measureText(it.ch).width) + 2 * pad);
      it.ax = ax;
      ax += it.aw + 2;
    }
    const AH = Math.ceil(F * 1.3 + 2 * pad);
    const atlas = document.createElement('canvas');
    atlas.width = ax; atlas.height = AH;
    const g = atlas.getContext('2d');
    g.font = `${F}px "Geist Pixel"`;
    g.textBaseline = 'alphabetic';
    for (const it of items) {
      for (const [blur, alpha] of [[22, 0.55], [0, 1]]) {
        g.save();
        g.shadowColor = `rgba(255,255,255,${alpha})`;
        g.shadowBlur = blur;
        g.fillStyle = '#ffffff';
        if (it.cursor) g.fillRect(it.ax + pad, pad + F - 0.78 * F, 0.42 * F, 0.95 * F);
        else g.fillText(it.ch, it.ax + pad, pad + F);
        g.restore();
      }
    }
    const tex = new THREE.CanvasTexture(atlas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const k = px / F; // screen px per atlas px
    // screen-space centre of each glyph cell
    const mouthScr = new THREE.Vector2(W / 2, H / 2);
    for (const it of items) {
      it.cx = it.left - pad * k + (it.aw * k) / 2;
      it.cy = base - (pad + F) * k + (AH * k) / 2;
      it.sw = it.aw * k; it.sh = AH * k;
      it.dist = Math.hypot(it.cx - mouthScr.x, (it.cy - mouthScr.y) * 0.6);
    }
    // centre letters go first, the ends last
    [...items].sort((a, b) => a.dist - b.dist).forEach((it, rank) => { it.t0 = IN.handoff + rank * IN.stagger; });
    // place them in 3D so the first frame matches the 2D text exactly
    this.placeCamera(IN.handoff);
    const cam = this.camera;
    cam.updateMatrixWorld();
    const D = 3.2;
    const perPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / H;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.letters = items.map((it, i) => {
      const ndc = new THREE.Vector3((it.cx / W) * 2 - 1, -(it.cy / H) * 2 + 1, 0.5).unproject(cam);
      const dir = ndc.sub(cam.position).normalize();
      const P = cam.position.clone().addScaledVector(dir, D / dir.dot(fwd));
      const geo = new THREE.PlaneGeometry(1, 1);
      const uv = geo.attributes.uv;
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (it.ax + uv.getX(v) * it.aw) / ax, uv.getY(v));
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      mesh.visible = false;
      this.scene.add(mesh);
      // path: toward the mouth, easing onto the axis, in, then on down the tube
      const B0 = P, B3 = new THREE.Vector3(0, 0, -0.9);
      const B1 = P.clone().lerp(B3, 0.25);
      const B2 = new THREE.Vector3(P.x * 0.1, P.y * 0.1, 1.4);
      const bez = new THREE.CubicBezierCurve3(B0, B1, B2, B3);
      return {
        mesh, mat, bez, len: bez.getLength(), t0: it.t0, w: it.sw * perPx, h: it.sh * perPx,
        roll: (hash(i, 3) < 0.5 ? -1 : 1) * (0.35 + 0.6 * hash(i, 4)),
        // inside the tube: carried along a little off the axis, so the camera can overtake them
        ang: hash(i, 5) * Math.PI * 2, rad: 0.22 + 0.32 * hash(i, 6),
      };
    });
    // light trails behind the letters
    const TR = 12;
    this.trailN = TR;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.letters.length * TR * 3), 3));
    tg.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(this.letters.length * TR), 1));
    this.trails = new THREE.Points(tg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = 300.0 * alpha / -mv.z; }',
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*14.0) * vA; gl_FragColor = vec4(vec3(1.0,0.86,0.66) * a, 1.0); }',
    }));
    this.trails.frustumCulled = false;
    this.scene.add(this.trails);
  }

  /** Where letter L is at time t: position, and how far along (q: 0 start, 1 at the mouth, >1 inside). */
  letterAt(L, t) {
    const dt = t - L.t0;
    const q = dt <= 0 ? 0 : Math.pow(dt / IN.letterT, 2.3);
    if (q <= 1) return { p: L.bez.getPoint(q), q };
    // through the mouth: the cable's flow takes over, slowing them to a steady 16 units/s,
    // so they hang just ahead of the camera as it dives in, until it overtakes them
    const u = dt - IN.letterT;
    const vIn = L.len * 2.3 / IN.letterT, vFlow = 16;
    const sAlong = 0.9 + vFlow * u + ((vIn - vFlow) / 9) * (1 - Math.exp(-9 * u));
    const f = this.frameAt(sAlong);
    const k = smoothstep(0, 0.25, u); // ease from the mouth onto their lane
    const ox = Math.cos(L.ang) * L.rad * k, oy = Math.sin(L.ang) * L.rad * k;
    return { p: f.p.clone().addScaledVector(f.n, oy).addScaledVector(f.b, ox), q, s: sAlong, u };
  }

  // ------------------------------------------------------------------ air rushing into the mouth
  buildSuction() {
    const N = 150;
    this.suck = [];
    const r = rng(91);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, rad = 2.2 + Math.pow(r(), 0.7) * 9;
      this.suck.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad * 1.3, z: 0.6 + r() * 9, period: 0.42 + r() * 0.4, ph: r(), c: [[1, 1, 1], [1, 0.85, 0.63], [0.5, 0.95, 1]][i % 3] });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.suckLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.suckLines.frustumCulled = false;
    this.scene.add(this.suckLines);
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
      if (t < a0) {
        // outside, holding still while the words are sucked into the cable
        return -(14.0 - 0.6);
      }
      if (t < a1) {
        const v = invLerp(a0, a1, t);
        const u = v * v * (0.55 + 0.45 * v);
        // dive: geometric zoom to just inside the mouth
        const d = Math.pow(14.0, 1 - u) * Math.pow(0.6, u);
        return -(d - 0.6);
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

  /** Put the camera where it is at time t; returns { s, speed }. */
  placeCamera(t) {
    const s = this.camS(t);
    const cam = this.camera;
    if (s < 0.4) {
      // outside / at the mouth: slightly off-axis (so the cable's body shows), straightening up
      const d = 0.4 - s;
      const off = smoothstep(0.6, 16, d);
      cam.position.set(1.0 * off, 1.3 * off, -s);
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
    cam.updateMatrixWorld();
    return { s, speed };
  }

  update(t, post) {
    const { s, speed } = this.placeCamera(t);
    const cam = this.camera;
    this.uniforms.uTime.value = t;
    this.uniforms.uCamS.value = s;
    const goingIn = t < OUT.flash;
    // far-end glow only near the end of the trip in, and at the start of the trip out
    this.uniforms.uEnd.value = goingIn ? smoothstep(IN.tunnel[1] - 0.55, IN.tunnel[1], t) : 1 - smoothstep(OUT.tunnel[0], OUT.tunnel[0] + 0.6, t);
    this.endLight.visible = true;
    this.updateLetters(t, cam, post);

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

    // post: speed blur + aberration, bloom high; during the pull, a zoom blur toward the mouth
    const blur = clamp(speed / 70, 0, 1);
    const pull = goingIn && t < IN.approach[1] ? smoothstep(IN.handoff, IN.swallow[1], t) : 0;
    post.radial = Math.max(0.2 + 0.8 * blur, 0.1 + 0.75 * pull);
    post.ca = Math.max(0.15 + 0.45 * blur, 0.5 * pull);
    if (goingIn && t < IN.approach[1]) {
      const m = new THREE.Vector3(0, 0, -0.3).project(cam);
      post.center = [m.x * 0.5 + 0.5, m.y * 0.5 + 0.5];
    }
    post.bloom = 0.85;
    post.bloomRadius = 0.45;
    post.bloomThreshold = 0.62;
    post.vignette = 0.55;
    post.grain = 0.02;
    post.speed = speed;
  }

  updateLetters(t, cam, post) {
    const active = t >= IN.open && t < IN.tunnel[1];
    // mouth glow: opens with the cable, flares as each letter is swallowed
    let flare = 0;
    for (const L of this.letters) {
      const dt = t - (L.t0 + IN.letterT);
      if (dt > -0.03) flare += Math.exp(-Math.max(0, dt) * 9) * (dt < 0 ? 1 + dt / 0.03 : 1);
    }
    this.mouthU.uA.value = active ? smoothstep(IN.open, IN.handoff + 0.1, t) * (0.38 + 0.07 * Math.min(flare, 4)) * (1 - smoothstep(IN.approach[0] + 0.2, IN.approach[1], t)) : 0;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const proj = (p) => { const v = p.clone().project(cam); return new THREE.Vector2(v.x * this.W / 2, v.y * this.H / 2); };
    const tp = this.trails.geometry.attributes.position, ta = this.trails.geometry.attributes.alpha;
    const M = new THREE.Matrix4(), A = new THREE.Matrix4(), S = new THREE.Matrix4(), Rm = new THREE.Matrix4().makeRotationFromQuaternion(cam.quaternion);
    this.letters.forEach((L, i) => {
      const show = active && t >= IN.handoff;
      L.mesh.visible = show;
      for (let k = 0; k < this.trailN; k++) ta.setX(i * this.trailN + k, 0);
      if (!show) return;
      const { p, q, s: ls, u: inside = 0 } = this.letterAt(L, t);
      const dist = p.distanceTo(cam.position);
      const behind = p.clone().sub(cam.position).dot(new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)) < 0.05;
      if (behind || (ls ?? 0) > this.len - 6) { L.mesh.visible = false; return; }
      // screen-space motion -> stretch toward the mouth (spaghettified), plus a random tumble
      const prev = this.letterAt(L, t - 1 / 30).p;
      const v2 = proj(p).sub(proj(prev));
      const sp = v2.length();
      const stretch = 1 + clamp((sp - 6) / 30, 0, 2.2) * clamp(q * 2.5, 0, 1);
      const phi = Math.atan2(v2.y, v2.x);
      const roll = L.roll * Math.pow(clamp(q, 0, 1.3), 1.4);
      const c = Math.cos(phi), s2 = Math.sin(phi), sq = 1 / Math.sqrt(stretch);
      // R(phi) * diag(stretch, sq) * R(-phi) * R(roll)
      const a11 = c * c * stretch + s2 * s2 * sq, a12 = c * s2 * (stretch - sq), a22 = s2 * s2 * stretch + c * c * sq;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const m11 = a11 * cr + a12 * sr, m12 = -a11 * sr + a12 * cr, m21 = a12 * cr + a22 * sr, m22 = -a12 * sr + a22 * cr;
      A.set(m11, m12, 0, 0, m21, m22, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      const grow = 1 + 0.7 * smoothstep(0, 0.3, inside);
      S.makeScale(L.w * grow, L.h * grow, 1);
      M.makeTranslation(p.x, p.y, p.z).multiply(Rm).multiply(A).multiply(S);
      L.mesh.matrix.copy(M);
      L.mesh.matrixWorldNeedsUpdate = true;
      L.mat.opacity = clamp(dist / 0.5, 0, 1);
      // trail: where it was a moment ago
      for (let k = 0; k < this.trailN; k++) {
        const tk = t - (k + 1) * 0.014;
        if (tk < L.t0) break;
        const pk = this.letterAt(L, tk).p;
        tp.setXYZ(i * this.trailN + k, pk.x, pk.y, pk.z);
        ta.setX(i * this.trailN + k, (1 - k / this.trailN) * 0.28 * clamp(q * 3, 0, 1) * L.mat.opacity);
      }
    });
    tp.needsUpdate = true;
    ta.needsUpdate = true;

    // air streaming into the mouth from all around
    const on = active ? smoothstep(IN.open, IN.handoff + 0.08, t) * (1 - smoothstep(IN.approach[0] + 0.15, IN.approach[1] - 0.05, t)) : 0;
    const sp = this.suckLines.geometry.attributes.position, sc = this.suckLines.geometry.attributes.color;
    const target = new THREE.Vector3(0, 0, -1.0);
    this.suck.forEach((d, i) => {
      const ph = ((t - IN.open) / d.period + d.ph) % 1;
      const at = (u) => { const e = Math.pow(u, 2.6); return new THREE.Vector3(lerp(d.x, target.x, e), lerp(d.y, target.y, e), lerp(d.z, target.z, e)); };
      const a = at(ph), b = at(Math.max(0, ph - 0.06));
      sp.setXYZ(i * 2, a.x, a.y, a.z);
      sp.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      const br = on * smoothstep(0.0, 0.3, ph) * (1 - smoothstep(0.8, 1.0, ph)) * 1.0;
      sc.setXYZ(i * 2, d.c[0] * br, d.c[1] * br, d.c[2] * br);
      sc.setXYZ(i * 2 + 1, 0, 0, 0);
    });
    sp.needsUpdate = true;
    sc.needsUpdate = true;
    this.suckLines.visible = on > 0.001;
  }
}
