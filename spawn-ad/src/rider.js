// The player's mount: a cantering horse (Quaternius "Ultimate Animated Animals", CC0) carrying a hooded
// rider with a cape streaming behind, seen from behind like an MMO character on a mount.
// The horse is placed on the road by ride.js; its gait is the model's Gallop clip at a fixed rate, so
// every frame is a pure function of time.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { riderPose } from './ride.js';
import { W0 } from './timeline.js';

const C = (hex) => new THREE.Color(hex);
const HORSE_SCALE = 0.43;
const GAIT_RATE = 0.85; // gallop clip speed (0.6 s cycle -> ~0.7 s per stride at 4.2 m/s)

export class Rider {
  constructor(scene) {
    this.scene = scene;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
  }

  async init() {
    const gltf = await new GLTFLoader().loadAsync('/assets/models/Horse.gltf');
    const horse = gltf.scene;
    horse.scale.setScalar(HORSE_SCALE);
    horse.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
        // smoother, slightly glossier coat than the flat originals
        const m = o.material;
        if (Array.isArray(m)) m.forEach(tune); else tune(m);
      }
    });
    function tune(m) {
      if (!m) return;
      m.roughness = 0.62;
      m.metalness = 0.0;
      m.flatShading = false;
      m.needsUpdate = true;
    }
    this.horse = horse;
    this.scene.add(horse);
    this.mixer = new THREE.AnimationMixer(horse);
    const clip = gltf.animations.find((a) => a.name === 'Gallop');
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.bone = {
      back: horse.getObjectByName('Back'),
      torso: horse.getObjectByName('Torso'),
      torso2: horse.getObjectByName('Torso2'),
      torso3: horse.getObjectByName('Torso3'),
    };
    this.buildRider();
    this.buildShadow();
  }

  buildRider() {
    const g = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: C('#123c44'), roughness: 0.85 });
    const trim = new THREE.MeshStandardMaterial({ color: C('#ffd9a0'), roughness: 0.6, metalness: 0.2 });
    const leather = new THREE.MeshStandardMaterial({ color: C('#4a2e20'), roughness: 0.7 });
    const blanket = new THREE.MeshStandardMaterial({ color: C('#1d96a0'), roughness: 0.8 });
    // saddle blanket and saddle on the horse's back
    const blanketGeo = new THREE.BoxGeometry(0.92, 0.05, 0.85);
    const bl = new THREE.Mesh(blanketGeo, blanket);
    bl.position.set(0, -0.05, 0.02);
    g.add(bl);
    for (const s of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.8), blanket);
      flap.position.set(s * 0.46, -0.24, 0.02);
      flap.rotation.z = s * 0.12;
      g.add(flap);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.82), trim);
      edge.position.set(s * 0.5, -0.45, 0.02);
      edge.rotation.z = s * 0.12;
      g.add(edge);
    }
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 16, 1), leather);
    saddle.scale.set(1.1, 1, 1.5);
    saddle.position.set(0, 0.04, 0.0);
    g.add(saddle);
    // the rider: legs in boots down the flanks, a cloaked body, a hood
    const body = new THREE.Group();
    body.position.set(0, 0.12, 0.04);
    g.add(body);
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.5, 10), cloth);
      thigh.position.set(s * 0.26, -0.05, -0.12);
      thigh.rotation.set(1.15, 0, s * 0.35);
      body.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.48, 10), leather);
      shin.position.set(s * 0.43, -0.38, -0.1);
      shin.rotation.set(0.1, 0, s * 0.18);
      body.add(shin);
    }
    // torso: a tapered cloak shape (lathe)
    const prof = [];
    const pts = [[0.0, 0.0], [0.36, 0.0], [0.38, 0.1], [0.33, 0.35], [0.27, 0.55], [0.22, 0.66], [0.12, 0.72], [0.0, 0.74]];
    for (const [r, y] of pts) prof.push(new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), cloth);
    torso.scale.set(1.0, 1.0, 0.72);
    torso.position.y = 0.0;
    torso.rotation.x = -0.12; // leaning forward a touch
    body.add(torso);
    // pauldrons
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), trim);
      p.position.set(s * 0.25, 0.6, -0.03);
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
    const capeGeo = new THREE.PlaneGeometry(0.62, 1.3, 12, 24);
    {
      const p = capeGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); // +0.65 (top) .. -0.65 (hem)
        const v = (0.65 - y) / 1.3;
        p.setX(i, p.getX(i) * (0.78 + 0.55 * v));
      }
    }
    capeGeo.translate(0, -0.65, 0);
    const capeMat = new THREE.MeshStandardMaterial({ color: C('#9a2636'), emissive: C('#3a0a12'), roughness: 0.78, side: THREE.DoubleSide });
    capeMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.capeU.uT;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;\nvarying float vFold;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float v = clamp(-position.y / 1.3, 0.0, 1.0);
          float ph = uT * 8.5 - v * 6.5;
          float wave = sin(ph + position.x * 4.0) * 0.11 + sin(uT * 13.0 - v * 10.0 - position.x * 6.0) * 0.045;
          transformed.z += v * v * 0.7 + v * 0.22 + wave * v;
          transformed.y += v * v * 0.32;
          transformed.x += sin(uT * 6.0 - v * 4.0) * 0.06 * v;
          vFold = sin(position.x * 16.0 + v * 3.0 + sin(ph) * 1.5) * 0.5 + 0.5;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFold;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.8 + 0.3 * vFold;');
    };
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 0.7, 0.16);
    cape.rotation.x = 0.1;
    body.add(cape);
    // a peach clasp line across the shoulders
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.05), trim);
    clasp.position.set(0, 0.68, 0.15);
    body.add(clasp);
    this.riderGroup = g;
    this.scene.add(g);
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
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    this.scene.add(this.shadow);
  }

  update(t) {
    if (!this.horse) return;
    const { pos, yaw } = riderPose(t);
    this.horse.position.copy(pos);
    this.horse.rotation.y = yaw;
    this.mixer.setTime(Math.max(0, t - W0 + 0.3) * GAIT_RATE);
    this.horse.updateMatrixWorld(true);
    // seat the rider on the horse's back so they move with the gait
    const p = this.bone.torso2.getWorldPosition(this._v);
    const q = this.bone.torso3.getWorldPosition(this._w);
    const pitch = Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
    const g = this.riderGroup;
    g.position.copy(p).lerp(q, 0.15);
    g.position.y += 0.2;
    g.rotation.set(0, 0, 0);
    g.rotation.y = yaw + Math.PI; // the rider's local -z faces the horse's head (+z of the model)
    g.rotateX(pitch * 0.5);
    this.capeU.uT.value = t;
    this.shadow.position.set(pos.x, 0.02, pos.z);
    this.shadow.rotation.z = -yaw;
  }

  /** Where the rider's head is (for the chat bubble above it). */
  headPosition(target = new THREE.Vector3()) {
    return this.riderGroup.localToWorld(target.set(0, 1.2, 0.0));
  }
}
