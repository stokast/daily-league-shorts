// The player on their mount: a realistic draft horse (src/horse.js, cantering by IK) in a teal saddle cloth
// with Spawn's sparkle on it and a leather saddle (both draped on the horse's back and skinned to it), carrying
// a hooded rider with a cape streaming behind, seen from behind like an MMO character on a mount.
// Every frame is a pure function of time.
import * as THREE from 'three';
import { Horse } from './horse.js';
import { riderPose, RIDE_SPEED } from './ride.js';
import { W0 } from './timeline.js';

const C = (hex) => new THREE.Color(hex);
const HORSE_SCALE = 0.88; // world metres per model unit: ~1.65 m at the withers
const SPARK = [[14, 0, 1], [14, 1, 1], [13, 2, 3], [12, 3, 5], [10, 4, 9], [12, 5, 5], [13, 6, 3], [14, 7, 1], [14, 8, 1]];

/** The saddle cloth's texture: teal wool, a peach border, Spawn's sparkle on each flank. */
function clothTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#1b8c96';
  x.fillRect(0, 0, c.width, c.height);
  // a woven look: fine noise and faint stripes along the cloth
  const img = x.getImageData(0, 0, c.width, c.height);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
    const k = 0.9 + 0.12 * rnd() + 0.05 * Math.sin(py * 0.9) * Math.sin(px * 0.7);
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  x.putImageData(img, 0, 0);
  // border: peach band with a dark inner line (u = 0 and 1 are the bottom edges, v the front and back)
  const B = 34;
  x.fillStyle = '#ffd9a0';
  x.fillRect(0, 0, B, c.height); x.fillRect(c.width - B, 0, B, c.height);
  x.fillRect(0, 0, c.width, B * 0.8); x.fillRect(0, c.height - B * 0.8, c.width, B * 0.8);
  x.fillStyle = '#0d4f56';
  x.fillRect(B, 0, 5, c.height); x.fillRect(c.width - B - 5, 0, 5, c.height);
  x.fillRect(0, B * 0.8, c.width, 4); x.fillRect(0, c.height - B * 0.8 - 4, c.width, 4);
  // the sparkle, low on each flank (rotated so it stands upright when the cloth hangs)
  for (const [cx, rot] of [[150, Math.PI / 2], [c.width - 150, -Math.PI / 2]]) {
    x.save();
    x.translate(cx, c.height / 2);
    x.rotate(rot);
    const cell = 9;
    x.fillStyle = '#ffd9a0';
    for (const [sx, sy, w] of SPARK) x.fillRect((sx - 14.5) * cell, (sy - 4.5) * cell, w * cell + 0.5, cell + 0.5);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A tapered cylinder from a to b (in the parent's frame). */
function limb(a, b, r0, r1, mat, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export class Rider {
  constructor(scene, world = null) {
    this.scene = scene;
    this.world = world;
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  adopt(m) {
    return this.world ? this.world.adopt(m) : m;
  }

  async init() {
    this.mount = new Horse({ scale: HORSE_SCALE });
    await this.mount.init((m) => this.adopt(m));
    this.scene.add(this.mount.root);
    this.buildTack();
    this.buildRider();
    this.buildShadow();
  }

  /** Saddle cloth and saddle, draped on the horse's back at rest and skinned to it. */
  buildTack() {
    const H = this.mount;
    const z = H.seatRest.z; // native: the horse faces -z
    const cloth = this.adopt(new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.92, side: THREE.DoubleSide }));
    H.drape({
      z0: z - 0.42, z1: z + 0.36, nu: 30, nv: 16, material: cloth,
      theta: (v) => 1.22 - 0.22 * Math.pow(Math.abs(2 * v - 1), 5), // rounded corners
      lift: (u, v) => 0.016 + 0.01 * (1 - u * u),
    });
    const leather = this.adopt(new THREE.MeshStandardMaterial({ color: C('#5a3220'), roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }));
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    H.drape({
      z0: z - 0.27, z1: z + 0.27, nu: 22, nv: 16, material: leather,
      // wide flaps in the middle, narrow at the pommel and the cantle
      theta: (v) => 0.42 + 0.5 * Math.pow(Math.sin(Math.PI * v), 0.7),
      lift: (u, v) => 0.045 + (0.13 * ss(0.72, 1, v) + 0.09 * ss(0.78, 1, 1 - v)) * Math.max(0, 1 - 2.2 * u * u) - 0.015 * Math.sin(Math.PI * v) * (1 - u * u),
    });
  }

  buildRider() {
    const g = new THREE.Group();
    const cloth = this.adopt(new THREE.MeshStandardMaterial({ color: C('#123c44'), roughness: 0.85 }));
    const trim = this.adopt(new THREE.MeshStandardMaterial({ color: C('#ffd9a0'), roughness: 0.55, metalness: 0.3 }));
    const leather = this.adopt(new THREE.MeshStandardMaterial({ color: C('#3b2418'), roughness: 0.6 }));
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // the rider's frame: origin on the top of the horse's back at the seat, -z toward the horse's head
    const body = new THREE.Group();
    body.position.set(0, 0.13, 0.02);
    g.add(body);
    // legs astride the barrel: thighs down the saddle flaps, shins down the cloth, boots in the stirrups
    for (const s of [-1, 1]) {
      const hip = V(s * 0.13, 0.0, 0.0), knee = V(s * 0.36, -0.3, -0.2), ankle = V(s * 0.37, -0.66, -0.06);
      body.add(limb(hip, knee, 0.095, 0.075, cloth));
      body.add(limb(knee, ankle, 0.07, 0.055, leather));
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.13, 4, 10), leather);
      boot.rotation.x = Math.PI / 2;
      boot.position.copy(ankle).add(V(0, -0.04, -0.06));
      body.add(boot);
      const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), trim);
      stirrup.position.copy(ankle).add(V(0, -0.08, -0.04));
      stirrup.rotation.y = Math.PI / 2;
      body.add(stirrup);
    }
    // torso: a tapered cloak (lathe), leaning forward a touch
    const prof = [[0.0, 0.0], [0.24, 0.0], [0.27, 0.1], [0.25, 0.35], [0.24, 0.55], [0.2, 0.66], [0.11, 0.72], [0.0, 0.74]];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20), cloth);
    torso.scale.set(1.0, 1.0, 0.7);
    torso.rotation.x = -0.12;
    body.add(torso);
    // arms down to the hands at the withers, holding the reins
    this.hands = [];
    for (const s of [-1, 1]) {
      const sh = V(s * 0.21, 0.6, -0.04), el = V(s * 0.25, 0.32, -0.2), hand = V(s * 0.1, 0.22, -0.42);
      body.add(limb(sh, el, 0.065, 0.055, cloth));
      body.add(limb(el, hand, 0.052, 0.045, cloth));
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), leather);
      glove.position.copy(hand);
      body.add(glove);
      this.hands.push(glove);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), trim);
      p.position.set(s * 0.22, 0.6, -0.03);
      p.rotation.z = -s * 0.3;
      body.add(p);
    }
    // hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), cloth);
    hood.scale.set(1, 1.15, 1.1);
    hood.position.set(0, 0.86, -0.04);
    body.add(hood);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 12), cloth);
    peak.position.set(0, 0.92, 0.1);
    peak.rotation.x = 1.9;
    body.add(peak);
    // the cape: a cloth strip from the shoulders, wider at the hem, streaming back and rippling
    this.capeU = { uT: { value: 0 } };
    const capeGeo = new THREE.PlaneGeometry(0.5, 1.0, 12, 24);
    {
      const p = capeGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); // +0.5 (top) .. -0.5 (hem)
        const v = (0.5 - y) / 1.0;
        const x = p.getX(i);
        p.setX(i, x * (0.85 + 0.4 * v));
        // pleats: gathered at the shoulders, opening toward the hem
        p.setZ(i, Math.sin((x / 0.5) * Math.PI * 5) * (0.008 + 0.03 * v) + 0.04 * (x / 0.25) * (x / 0.25) * (1 - v));
      }
    }
    capeGeo.translate(0, -0.5, 0);
    capeGeo.computeVertexNormals();
    const capeMat = new THREE.MeshStandardMaterial({ color: C('#9a2636'), emissive: C('#3a0a12'), roughness: 0.78, side: THREE.DoubleSide });
    this.adopt(capeMat);
    const prev = capeMat.onBeforeCompile, prevKey = capeMat.customProgramCacheKey;
    capeMat.onBeforeCompile = (sh, r) => {
      prev?.call(capeMat, sh, r);
      sh.uniforms.uT = this.capeU.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;\nvarying float vFold;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float v = clamp(-position.y / 1.0, 0.0, 1.0);
          float ph = uT * 8.5 - v * 6.5;
          float wave = sin(ph + position.x * 4.0) * 0.09 + sin(uT * 13.0 - v * 10.0 - position.x * 6.0) * 0.04;
          transformed.z += v * v * 0.75 + v * 0.25 + wave * v;
          transformed.y += v * v * 0.42;
          transformed.x += sin(uT * 6.0 - v * 4.0) * 0.06 * v;
          vFold = sin(position.x * 16.0 + v * 3.0 + sin(ph) * 1.5) * 0.5 + 0.5;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFold;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.8 + 0.3 * vFold;');
    };
    capeMat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + ':cape';
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 0.7, 0.16);
    cape.rotation.x = 0.1;
    body.add(cape);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), trim);
    clasp.position.set(0, 0.68, 0.15);
    body.add(clasp);
    this.riderBody = body;
    this.riderGroup = g;
    this.scene.add(g);
    // reins: hands to the bit
    const reinMat = this.adopt(new THREE.MeshStandardMaterial({ color: C('#2a1a12'), roughness: 0.6 }));
    this.reins = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1), reinMat);
      this.scene.add(m);
      return m;
    });
  }

  buildShadow() {
    // a soft contact shadow under the horse (cheaper than redrawing the sun's shadow map every frame)
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    this.scene.add(this.shadow);
  }

  update(t) {
    if (!this.mount?.ready) return;
    const { pos, yaw } = riderPose(t);
    this.mount.update(Math.max(0, t - W0) + 0.21, pos, yaw, RIDE_SPEED);
    // the rider sits the canter: follows the saddle, but takes only half its rocking
    const { pos: seat, quat } = this.mount.seat(this._v, this._q);
    const g = this.riderGroup;
    g.position.copy(seat);
    const level = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + Math.PI);
    g.quaternion.copy(level).slerp(quat, 0.5);
    g.updateMatrixWorld(true);
    this.capeU.uT.value = t;
    // reins from the hands to the corners of the mouth
    const bit = this.mount.bit();
    for (let i = 0; i < 2; i++) {
      const a = this.hands[i].getWorldPosition(new THREE.Vector3());
      const b = bit[i];
      const r = this.reins[i];
      const d = new THREE.Vector3().subVectors(b, a);
      r.position.copy(a).addScaledVector(d, 0.5);
      r.scale.set(1, d.length(), 1);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
    this.shadow.position.set(pos.x, 0.02, pos.z);
    this.shadow.rotation.z = -yaw;
  }

  /** Where the rider's head is (for the chat bubble above it). */
  headPosition(target = new THREE.Vector3()) {
    return this.riderBody.localToWorld(target.set(0, 1.05, 0.0));
  }
}
