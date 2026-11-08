// The mount: a realistic draft horse, "HORSE [DRAFT HORSE]" by BlueMesh on Sketchfab (CC BY 4.0; fetched by
// tools/fetch-assets.mjs from the Objaverse mirror), on its author's rig. It comes without animation: the canter
// is made here. A right-lead canter is solved with IK every frame, so the hooves stay planted on the road while
// the horse moves at the ride's speed. Every frame is a pure function of time.
//
// Conventions: "native" is the glTF scene's own frame (the horse faces -z, +x is its right, hooves at y = G).
// The model sits in `flip`, which turns it to face +z and scales it; `root` is placed on the road.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const boneName = (n) => (n === 0 ? 'Bone_Armature' : `Bone${String(n).padStart(3, '0')}_Armature`);

// the author's armature, by bone number
const RIG = {
  neck: [0, 1, 2, 3, 4], // neck base -> poll
  head: 14,
  spine: [5, 6, 7, 8], // withers -> croup
  tail: [26, 27, 28, 29, 30],
  legs: {
    // chain: front = forearm, cannon, pastern; hind = femur, tibia, cannon, pastern
    LH: { chain: [34, 36, 38, 40], front: false },
    RH: { chain: [33, 35, 37, 39], front: false },
    LF: { chain: [44, 46, 48], front: true },
    RF: { chain: [43, 45, 47], front: true },
  },
};

// the canter (phases are fractions of a stride; LH lands first, then the diagonal pair, then the lead foreleg)
export const GAIT = {
  period: 0.64, // s per stride
  td: { LH: 0.0, RH: 0.19, LF: 0.21, RF: 0.38 },
  duty: { front: 0.34, hind: 0.37 }, // fraction of the stride a hoof is on the ground
  ahead: { front: 0.62, hind: 0.5 }, // where a hoof lands: this much of the stance length ahead of where it stands at rest
  lift: { front: 0.4, hind: 0.27 }, // how high the fetlock rises in the swing (native units)
  reach: { front: 0.11, hind: 0.07 }, // shoulder / hip travel fore and aft over a stride
};

const V3 = () => new THREE.Vector3();
const frac = (x) => x - Math.floor(x);

/** A periodic Catmull-Rom curve through [phase, value] keys (phase in [0, 1)). */
function loop(keys, x) {
  const n = keys.length;
  x = frac(x);
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= x) i = k;
  const at = (k) => {
    const m = ((k % n) + n) % n;
    const wraps = Math.floor(k / n);
    return [keys[m][0] + wraps, keys[m][1]];
  };
  const [x0, p0] = at(i - 1), [x1, p1] = at(i), [x2, p2] = at(i + 1), [x3, p3] = at(i + 2);
  const xx = x < x1 ? x + 1 : x;
  const u = (xx - x1) / (x2 - x1);
  // non-uniform tangents (keys aren't evenly spaced)
  const m1 = ((p2 - p1) / (x2 - x1) + (p1 - p0) / (x1 - x0)) * 0.5 * (x2 - x1);
  const m2 = ((p3 - p2) / (x3 - x2) + (p2 - p1) / (x2 - x1)) * 0.5 * (x2 - x1);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}

/** A Catmull-Rom curve through [x, value] keys (x ascending), held flat beyond the ends. */
function curve(keys, x) {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] <= x) i++;
  const k = (j) => keys[Math.max(0, Math.min(n - 1, j))];
  const [x0, p0] = k(i - 1), [x1, p1] = k(i), [x2, p2] = k(i + 1), [x3, p3] = k(i + 2);
  const u = (x - x1) / (x2 - x1);
  const t1 = i === 0 ? 0 : ((p2 - p1) / (x2 - x1) + (p1 - p0) / (x1 - x0)) * 0.5 * (x2 - x1);
  const t2 = i + 2 > n - 1 ? 0 : ((p3 - p2) / (x3 - x2) + (p2 - p1) / (x2 - x1)) * 0.5 * (x2 - x1);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * t1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * t2;
}

/** Warp a leg's phase so stance is [0, 0.5) and swing [0.5, 1): w = cos(2π·warp) is +1 at touchdown, -1 at liftoff. */
const warp = (p, duty) => (p < duty ? 0.5 * (p / duty) : 0.5 + 0.5 * ((p - duty) / (1 - duty)));

/** Two-bone IK: the middle joint for a chain root -> target with lengths l1, l2, bending toward `pole`. */
function twoBone(root, target, l1, l2, pole, out) {
  const d = V3().subVectors(target, root);
  let dist = d.length();
  d.divideScalar(dist || 1);
  dist = THREE.MathUtils.clamp(dist, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  out.copy(root).addScaledVector(d, a).addScaledVector(p, h);
  return dist; // the (clamped) reach used
}

const _p = V3(), _s = V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class Horse {
  /**
   * @param {object} o
   * @param {number} o.scale world metres per native unit (the model is ~1.7 m at the withers at 1)
   */
  constructor({ scale = 0.95 } = {}) {
    this.scale = scale;
    this.root = new THREE.Group();
    this.flip = new THREE.Group();
    this.root.add(this.flip);
    this.ready = false;
  }

  async init(adopt = (m) => m, url = '/assets/models/DraftHorse.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    let body = null;
    const hair = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.isSkinnedMesh && o.name.startsWith('BASE')) body = o;
      else if (o.isSkinnedMesh) o.visible = false; // the eyes: bound off the head in the export (the texture has eyes)
      else hair.push(o);
    });
    this.body = body;
    this.model = model;
    const B = (n) => model.getObjectByName(boneName(n));
    this.B = B;
    const bones = body.skeleton.bones;
    this.bind = new Map(bones.map((b) => [b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
    this.native = (b, out = V3()) => b.getWorldPosition(out).applyMatrix4(this.invModel); // during update
    // native positions at bind (the model is still at identity here)
    const at = (n) => B(n).getWorldPosition(V3());

    // The rig's rest pose isn't the pose the mesh was bound in (its inverse bind matrices map a smaller,
    // differently placed bind shape onto the skeleton), so everything here works from where the vertices are
    // drawn at rest: the skinned positions.
    const pos = body.geometry.attributes.position, si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight;
    body.updateMatrixWorld(true);
    const bodyW = new Float32Array(pos.count * 3);
    const v = V3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      body.applyBoneTransform(i, v).applyMatrix4(body.matrixWorld);
      bodyW[i * 3] = v.x; bodyW[i * 3 + 1] = v.y; bodyW[i * 3 + 2] = v.z;
    }
    this.bodyW = bodyW;
    // rest skinning matrix of each bone, in the body mesh's local space (drawn = blend(K) * bind)
    this.K = bones.map((b, i) => new THREE.Matrix4()
      .multiplyMatrices(body.bindMatrixInverse, b.matrixWorld)
      .multiply(body.skeleton.boneInverses[i])
      .multiply(body.bindMatrix).elements);
    this.buildGrid();
    const weightOf = (i, bi) => {
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) return sw.getComponent(i, k);
      return 0;
    };

    // legs: lengths, the hoof's contact point (on the leaf bone) and rest positions
    this.legs = {};
    let G = Infinity;
    for (const [name, def] of Object.entries(RIG.legs)) {
      const chain = def.chain.map(B);
      const leaf = chain[chain.length - 1];
      const li = bones.indexOf(leaf);
      // sole: the lowest vertices that follow the leaf bone
      let minY = Infinity;
      const idx = [];
      for (let i = 0; i < pos.count; i++) if (weightOf(i, li) > 0.5) { idx.push(i); minY = Math.min(minY, bodyW[i * 3 + 1]); }
      const sole = V3();
      let n = 0;
      for (const i of idx) if (bodyW[i * 3 + 1] < minY + 0.03) { sole.x += bodyW[i * 3]; sole.z += bodyW[i * 3 + 2]; n++; }
      sole.x /= n; sole.z /= n; sole.y = minY;
      G = Math.min(G, minY);
      const joints = chain.map((b) => b.getWorldPosition(V3()));
      const lengths = [];
      for (let k = 0; k < chain.length - 1; k++) lengths.push(joints[k].distanceTo(joints[k + 1]));
      const F = joints[joints.length - 1];
      this.legs[name] = {
        name, front: def.front, chain, lengths, leaf,
        contactLocal: sole.clone().applyMatrix4(_m.copy(leaf.matrixWorld).invert()), // the sole in the leaf bone's frame
        p: F.distanceTo(sole), // fetlock -> sole
        hoofRest: sole.clone(),
      };
    }
    this.G = G;
    for (const L of Object.values(this.legs)) L.hoofRest.y = G;

    // the saddle sits on the back between these spine bones; the rider's seat follows them
    this.seatBone = B(6);
    this.seatRest = at(6).lerp(at(7), 0.45);
    let top = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const dx = bodyW[i * 3] - this.seatRest.x, dz = bodyW[i * 3 + 2] - this.seatRest.z;
      if (dx * dx + dz * dz < 0.05 * 0.05) top = Math.max(top, bodyW[i * 3 + 1]);
    }
    this.seatRest.y = top; // the top of the back there
    this.seatBoneRestInv = this.seatBone.matrixWorld.clone().invert();
    // the corners of the mouth, where the reins meet the bit
    this.headBone = B(15);
    this.headRestInv = this.headBone.matrixWorld.clone().invert();
    this.bitRest = [V3(-0.075, 0.5, -1.33), V3(0.075, 0.5, -1.33)];

    this.skinHair(hair);

    // materials: the village's display curve and haze; the hair also sways (tail streaming, mane bouncing)
    adopt(body.material);
    body.material.roughness = 1; // the ORM map drives it
    {
      // a satin coat rather than a varnished one: lift the map's roughness a little
      const mat = body.material, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
      mat.onBeforeCompile = (sh, r) => {
        prev.call(mat, sh, r);
        sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, 0.3);');
      };
      mat.customProgramCacheKey = () => prevKey() + ':coat';
    }
    this.sway = { uPhase: { value: 0 }, uSide: { value: V3() }, uBack: { value: V3() }, uUp: { value: V3() } };
    const toLocal = new THREE.Matrix3().setFromMatrix4(body.matrixWorld.clone().invert());
    this.sway.uSide.value.set(1, 0, 0).applyMatrix3(toLocal);
    this.sway.uBack.value.set(0, 0, 1).applyMatrix3(toLocal);
    this.sway.uUp.value.set(0, 1, 0).applyMatrix3(toLocal);
    for (const mat of new Set(this.hair.map((h) => h.material))) {
      adopt(mat);
      const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
      mat.onBeforeCompile = (sh, r) => {
        prev.call(mat, sh, r);
        Object.assign(sh.uniforms, this.sway);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uPhase;\nuniform vec3 uSide, uBack, uUp;')
          .replace('#include <skinning_vertex>', `#include <skinning_vertex>
          {
            float ph = uPhase * 6.2831853;
            float k = abs(aSway);
            if (aSway > 0.0) {
              // tail: streams back and up a little, swings side to side, the wave running down it
              transformed += uBack * k * k * (0.16 + 0.05 * sin(ph - k * 3.0));
              transformed += uUp * k * k * (0.05 + 0.04 * sin(ph - 0.8 - k * 2.5));
              transformed += uSide * k * k * 0.07 * sin(ph * 1.0 + 0.6 - k * 2.2);
            } else if (aSway < 0.0) {
              // mane: bounces with the stride
              transformed += uUp * k * 0.035 * sin(ph - 0.9 - k * 1.5);
              transformed += uSide * k * 0.02 * sin(ph * 2.0 - k * 2.0);
            }
          }`);
      };
      mat.customProgramCacheKey = () => prevKey() + ':hair';
    }

    // into the world: face +z, scaled, hooves on y = 0
    this.flip.rotation.y = Math.PI;
    this.flip.scale.setScalar(this.scale);
    this.flip.position.y = -G * this.scale;
    this.flip.add(model);
    this.invModel = new THREE.Matrix4();
    this.modelRot = new THREE.Matrix4();
    this.ready = true;
  }

  // ------------------------------------------------------------------------------------- skinning helpers
  buildGrid() {
    const W = this.bodyW, CELL = 0.06;
    this.grid = new Map();
    for (let i = 0; i < W.length / 3; i++) {
      const k = `${Math.floor(W[i * 3] / CELL)},${Math.floor(W[i * 3 + 1] / CELL)},${Math.floor(W[i * 3 + 2] / CELL)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    }
    this.cell = CELL;
  }

  /** The body vertex drawn nearest to a native rest position. */
  nearestBody(x, y, z) {
    const W = this.bodyW, CELL = this.cell;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    for (let r = 0; r < 16; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        const cell = this.grid.get(`${cx + i},${cy + j},${cz + k}`);
        if (!cell) continue;
        for (const vi of cell) {
          const dx = W[vi * 3] - x, dy = W[vi * 3 + 1] - y, dz = W[vi * 3 + 2] - z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = vi; }
        }
      }
      if (best >= 0 && Math.sqrt(bd) <= r * CELL) break; // further rings are farther than this
    }
    return best;
  }

  /**
   * Make a skinned mesh on the horse's rig from a geometry given in native rest coordinates (where it should
   * be drawn at rest). Each vertex takes the skin weights of the nearest body vertex, or of weightsFor(i, x, y, z)
   * -> [[boneIndex, weight], ...], and is moved into the bind space through the inverse of its rest skinning.
   */
  bindToRig(g, material, weightsFor = null) {
    const body = this.body;
    const si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight;
    const pos = g.attributes.position, nor = g.attributes.normal;
    const n = pos.count;
    const sIdx = new Uint16Array(n * 4), sWt = new Float32Array(n * 4);
    const invBody = body.matrixWorld.clone().invert();
    const invBodyN = new THREE.Matrix3().setFromMatrix4(invBody);
    const S = new THREE.Matrix4(), Si = new THREE.Matrix4(), N3 = new THREE.Matrix3();
    const p = V3(), nn = V3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      const ws = weightsFor ? weightsFor(i, p.x, p.y, p.z) : null;
      if (ws) {
        ws.forEach(([b, w], k) => { sIdx[i * 4 + k] = b; sWt[i * 4 + k] = w; });
      } else {
        const j = this.nearestBody(p.x, p.y, p.z);
        for (let k = 0; k < 4; k++) { sIdx[i * 4 + k] = si.getComponent(j, k); sWt[i * 4 + k] = sw.getComponent(j, k); }
      }
      const e = S.elements;
      e.fill(0);
      for (let k = 0; k < 4; k++) {
        const wt = sWt[i * 4 + k];
        if (!wt) continue;
        const ke = this.K[sIdx[i * 4 + k]];
        for (let j = 0; j < 16; j++) e[j] += wt * ke[j];
      }
      Si.copy(S).invert();
      p.applyMatrix4(invBody).applyMatrix4(Si);
      pos.setXYZ(i, p.x, p.y, p.z);
      if (nor) {
        // drawn = S * bind, so the bind normal is ~ S^T * the drawn one
        nn.fromBufferAttribute(nor, i).applyMatrix3(invBodyN).normalize();
        nn.applyMatrix3(N3.setFromMatrix4(S).transpose()).normalize();
        nor.setXYZ(i, nn.x, nn.y, nn.z);
      }
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sWt, 4));
    g.computeBoundingSphere();
    const sm = new THREE.SkinnedMesh(g, material);
    sm.frustumCulled = false;
    sm.position.copy(body.position); sm.quaternion.copy(body.quaternion); sm.scale.copy(body.scale);
    body.parent.add(sm);
    sm.bind(body.skeleton, body.bindMatrix);
    return sm;
  }

  /**
   * The loose hair (mane, forelock, tail, feathers) isn't skinned in the export: bind it to the rig. Tail strands
   * follow the nearest tail bones; everything else the skin under it.
   */
  skinHair(hair) {
    const bones = this.body.skeleton.bones, B = this.B;
    const tailIdx = RIG.tail.map((n) => bones.indexOf(B(n)));
    const tailPts = RIG.tail.map((n) => B(n).getWorldPosition(V3()));
    const lastDir = V3(0, 1, 0).applyQuaternion(B(RIG.tail[RIG.tail.length - 1]).getWorldQuaternion(new THREE.Quaternion()));
    tailPts.push(tailPts[tailPts.length - 1].clone().addScaledVector(lastDir, 1.2));
    const ab = V3(), ap = V3(), q = V3();
    const segDist = (pt, a, b) => {
      ab.subVectors(b, a); ap.subVectors(pt, a);
      const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
      return ap.addScaledVector(ab, -t).length();
    };
    const tailStart = tailPts[1];
    const dockY = tailPts[2].y;
    this.hair = [];
    for (const h of hair) {
      const g = h.geometry.clone();
      g.applyMatrix4(h.matrixWorld); // native rest positions (the hair isn't skinned: drawn where it is)
      const pos = g.attributes.position;
      const count = pos.count;
      // strands: connected pieces, so a strand is classed (tail or not) as a whole
      const parent = new Int32Array(count).map((_, i) => i);
      const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      const idx = g.index.array;
      for (let t = 0; t < idx.length; t += 3) {
        const a = find(idx[t]), b = find(idx[t + 1]);
        parent[b] = a;
        parent[find(idx[t + 2])] = a;
      }
      const rootOf = new Map();
      for (let i = 0; i < count; i++) {
        const r = find(i), cur = rootOf.get(r);
        if (cur === undefined || pos.getY(i) > pos.getY(cur)) rootOf.set(r, i);
      }
      const tail = new Map();
      for (const [r, i] of rootOf) tail.set(r, pos.getZ(i) > tailStart.z - 0.25 && Math.abs(pos.getX(i)) < 0.25 && pos.getY(i) > -0.3);
      // sway weights: tail (+) by how far down the tail, mane (-) by how far down its strand
      const sway = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const r = find(i);
        if (tail.get(r)) sway[i] = THREE.MathUtils.clamp((dockY - pos.getY(i)) / 1.0, 0, 1);
        else if (pos.getY(rootOf.get(r)) > 0.3 && pos.getZ(rootOf.get(r)) < -0.2) sway[i] = -THREE.MathUtils.clamp((pos.getY(rootOf.get(r)) - pos.getY(i)) / 0.4, 0, 1);
      }
      g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
      const sm = this.bindToRig(g, h.material, (i, x, y, z) => {
        if (!tail.get(find(i))) return null;
        q.set(x, y, z);
        let d0 = Infinity, d1 = Infinity, b0 = 0, b1 = 0;
        for (let k = 0; k < tailIdx.length; k++) {
          const d = segDist(q, tailPts[k], tailPts[k + 1]);
          if (d < d0) { d1 = d0; b1 = b0; d0 = d; b0 = tailIdx[k]; } else if (d < d1) { d1 = d; b1 = tailIdx[k]; }
        }
        const w0 = 1 / Math.pow(d0 + 0.02, 4), w1 = 1 / Math.pow(d1 + 0.02, 4);
        return [[b0, w0 / (w0 + w1)], [b1, w1 / (w0 + w1)]];
      });
      sm.name = 'hair';
      h.parent.remove(h);
      this.hair.push(sm);
    }
  }

  /**
   * A cloth laid over the horse's back at rest (a saddle cloth, a saddle), skinned so it moves with the horse.
   * The surface is found by casting rays out from inside the barrel; `lift(u, v)` raises it off the skin
   * (native units). u runs across the back (-1 left .. 1 right), v along it (0 front .. 1 back).
   * @returns {THREE.SkinnedMesh}
   */
  drape({ z0, z1, theta, lift, nu = 28, nv = 18, material, yc = null }) {
    const W = this.bodyW, idx = this.body.geometry.index.array;
    const cy = yc ?? this.seatRest.y - 0.42;
    // the body's triangles near the region
    const tris = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const zc = (W[a + 2] + W[b + 2] + W[c + 2]) / 3, yy = (W[a + 1] + W[b + 1] + W[c + 1]) / 3;
      if (zc > Math.min(z0, z1) - 0.15 && zc < Math.max(z0, z1) + 0.15 && yy > cy - 0.7) tris.push(a, b, c);
    }
    const e1 = V3(), e2 = V3(), pv = V3(), tv = V3(), qv = V3(), o = V3(), d = V3();
    const cast = () => {
      let best = Infinity;
      for (let k = 0; k < tris.length; k += 3) {
        const a = tris[k], b = tris[k + 1], c = tris[k + 2];
        e1.set(W[b] - W[a], W[b + 1] - W[a + 1], W[b + 2] - W[a + 2]);
        e2.set(W[c] - W[a], W[c + 1] - W[a + 1], W[c + 2] - W[a + 2]);
        pv.crossVectors(d, e2);
        const det = e1.dot(pv);
        if (Math.abs(det) < 1e-9) continue;
        tv.set(o.x - W[a], o.y - W[a + 1], o.z - W[a + 2]);
        const u = tv.dot(pv) / det;
        if (u < 0 || u > 1) continue;
        qv.crossVectors(tv, e1);
        const vv = d.dot(qv) / det;
        if (vv < 0 || u + vv > 1) continue;
        const t = e2.dot(qv) / det;
        if (t > 0.02 && t < best) best = t;
      }
      return best;
    };
    const P = [], UV = [];
    for (let j = 0; j <= nv; j++) {
      const vv = j / nv;
      const z = z0 + (z1 - z0) * vv;
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * 2 - 1;
        const th = u * (typeof theta === 'function' ? theta(vv) : theta);
        o.set(0, cy, z);
        d.set(Math.sin(th), Math.cos(th), 0);
        let hit = cast();
        if (!Number.isFinite(hit)) hit = 0.45;
        const r = hit + lift(u, vv);
        P.push(o.x + d.x * r, o.y + d.y * r, o.z);
        UV.push((u + 1) / 2, 1 - vv);
      }
    }
    const index = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1;
      index.push(a, c, b, b, c, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return this.bindToRig(g, material);
  }

  /** Reset every bone to its bind pose. */
  rest() {
    for (const [b, r] of this.bind) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
  }

  /** Rotate a bone (in native space) by angle about a native axis through its head. */
  turn(bone, axis, angle) {
    if (!angle) return;
    bone.parent.updateWorldMatrix(true, false);
    const qp = _q.setFromRotationMatrix(_m.extractRotation(bone.parent.matrixWorld));
    const qw = _q2.copy(qp).multiply(bone.quaternion);
    const ax = axis.clone().transformDirection(this.modelRot).normalize(); // native -> world direction
    qw.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, angle));
    bone.quaternion.copy(qp.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }

  /** Point a bone's local axis along a native direction (minimal rotation, so its roll follows the parent). */
  aim(bone, localAxis, dirNative) {
    bone.updateWorldMatrix(true, false);
    const qw = new THREE.Quaternion();
    bone.matrixWorld.decompose(_p, qw, _s);
    const cur = localAxis.clone().applyQuaternion(qw).normalize();
    const want = dirNative.clone().transformDirection(this.modelRot).normalize();
    qw.premultiply(new THREE.Quaternion().setFromUnitVectors(cur, want));
    const qp = new THREE.Quaternion();
    bone.parent.matrixWorld.decompose(_p, qp, _s);
    bone.quaternion.copy(qp.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }

  /** Move a bone's head to a native position (keeping its rotation). */
  moveTo(bone, posNative) {
    const world = posNative.clone().applyMatrix4(this.model.matrixWorld);
    bone.position.copy(world.applyMatrix4(_m.copy(bone.parent.matrixWorld).invert()));
    bone.updateMatrixWorld(true);
  }

  /**
   * Pose and place the horse at time t.
   * @param {number} t seconds
   * @param {THREE.Vector3} pos ground point under the horse (world)
   * @param {number} yaw heading (0 faces +z)
   * @param {number} speed m/s over the ground
   */
  update(t, pos, yaw, speed) {
    if (!this.ready) return;
    this.root.position.copy(pos);
    this.root.rotation.set(0, yaw, 0);
    this.root.updateMatrixWorld(true);
    this.invModel.copy(this.model.matrixWorld).invert();
    this.modelRot.extractRotation(this.model.matrixWorld);
    this.rest();
    this.model.updateMatrixWorld(true);

    const T = GAIT.period;
    const ph = frac(t / T);
    this.sway.uPhase.value = ph;
    const V = speed / this.scale; // native units per second
    const X = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);
    const TAU = Math.PI * 2;

    // ---- body: the canter's rocking (forehand up while the hind legs push, down as the lead fore lands),
    // a bob (lowest over the diagonal support, highest in the moment of suspension) and a little roll
    const pitch = loop([[0.0, 0.0], [0.17, 0.05], [0.4, 0.0], [0.62, -0.055], [0.85, -0.01]], ph);
    const bob = loop([[0.0, -0.01], [0.3, -0.045], [0.5, -0.03], [0.72, 0.015], [0.9, 0.03]], ph);
    const roll = 0.02 * Math.sin(TAU * (ph - 0.25));
    const rootJ = this.model.getObjectByName('Armature_rootJoint');
    {
      const C = new THREE.Vector3(0, 0.1, 0.25); // about the girth
      const M = new THREE.Matrix4().makeTranslation(C.x, C.y + bob, C.z)
        .multiply(new THREE.Matrix4().makeRotationX(pitch))
        .multiply(new THREE.Matrix4().makeRotationZ(roll))
        .multiply(new THREE.Matrix4().makeTranslation(-C.x, -C.y, -C.z));
      // native: M * (root joint's native matrix) -> back to its local
      const nat = new THREE.Matrix4().multiplyMatrices(this.invModel, rootJ.matrixWorld);
      const want = new THREE.Matrix4().multiplyMatrices(this.model.matrixWorld, M.multiply(nat));
      const loc = new THREE.Matrix4().multiplyMatrices(_m.copy(rootJ.parent.matrixWorld).invert(), want);
      loc.decompose(rootJ.position, rootJ.quaternion, rootJ.scale);
      rootJ.updateMatrixWorld(true);
    }
    // back: the loins round as the hind legs reach under, open as they push
    const hindW = Math.cos(TAU * warp(frac(ph - 0.08), 0.4));
    this.turn(this.B(7), X, 0.035 * hindW);
    this.turn(this.B(8), X, 0.03 * hindW);
    // neck and head: nod with the stride, a beat after the forehand
    const nod = loop([[0.0, 0.03], [0.25, 0.07], [0.5, -0.02], [0.72, -0.07], [0.9, -0.02]], ph);
    this.turn(this.B(0), X, -0.06 + nod * 0.5);
    this.turn(this.B(2), X, nod * 0.6);
    this.turn(this.B(RIG.head), X, 0.08 - nod * 0.7);
    // tail: carried up, bouncing a little behind the croup
    const tb = Math.sin(TAU * (ph - 0.15));
    this.turn(this.B(27), X, -0.32 - 0.06 * tb);
    this.turn(this.B(28), X, -0.12 - 0.07 * Math.sin(TAU * (ph - 0.25)));
    this.turn(this.B(29), X, -0.05 - 0.08 * Math.sin(TAU * (ph - 0.35)));
    this.turn(this.B(28), new THREE.Vector3(0, 1, 0), 0.06 * Math.sin(TAU * (ph - 0.1)));

    // ---- legs
    const J = [V3(), V3(), V3(), V3()];
    this.debug = {};
    for (const L of Object.values(this.legs)) {
      const kind = L.front ? 'front' : 'hind';
      const D = GAIT.duty[kind];
      const lp = frac(ph - GAIT.td[L.name]); // 0 at touchdown
      const stance = lp < D;
      const Ls = V * D * T; // stance length (native)
      const zTd = L.hoofRest.z - GAIT.ahead[kind] * Ls;
      const zLo = zTd + Ls;
      const hx = L.hoofRest.x * 0.86;
      // shoulder / hip: forward as the leg reaches, back as it pushes
      const w = Math.cos(TAU * warp(lp, D));
      const rootBone = L.chain[0];
      const R = this.native(rootBone).addScaledVector(FWD, GAIT.reach[kind] * w);
      this.moveTo(rootBone, R);

      // hoof and pastern
      const H = V3();
      let psi; // pastern angle from straight down, forward positive (radians)
      if (stance) {
        const u = lp / D;
        H.set(hx, this.G, zTd + Ls * u);
        // loaded: the fetlock sinks (pastern flatter) mid-stance; breakover: the heel lifts, the pastern stands up
        psi = L.front ? curve([[0, 0.62], [0.45, 0.8], [0.8, 0.5], [1, 0.12]], u) : curve([[0, 0.6], [0.45, 0.74], [0.8, 0.45], [1, 0.12]], u);
      } else {
        const u = (lp - D) / (1 - D);
        // hermite in z: leaves moving back at ground speed, swings forward, retracts a little to land
        const Ts = (1 - D) * T;
        const m = V * Ts;
        const u2 = u * u, u3 = u2 * u;
        H.z = (2 * u3 - 3 * u2 + 1) * zLo + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * zTd + (u3 - u2) * m;
        const lift = GAIT.lift[kind] * Math.pow(Math.sin(Math.PI * Math.pow(u, L.front ? 0.75 : 0.9)), 1.4);
        H.x = hx * (1 - 0.15 * Math.sin(Math.PI * u));
        H.y = this.G + lift;
        // the hoof folds back under the fetlock, then reaches forward to land
        psi = curve([[0, 0.12], [0.3, L.front ? -1.9 : -1.4], [0.62, -0.6], [0.88, 0.75], [1, L.front ? 0.62 : 0.6]], u);
      }
      const pdir = V3().addScaledVector(FWD, Math.sin(psi)).addScaledVector(UP, -Math.cos(psi)); // fetlock -> sole
      const F = H.clone().addScaledVector(pdir, -L.p);
      const [l0, l1, l2] = L.lengths;
      J[0].copy(R);
      const pole = FWD.clone().addScaledVector(UP, 0.15);
      if (L.front) {
        // forearm + cannon; the knee folds forward of the line
        const reach = twoBone(R, F, l0, l1, pole, J[1]);
        this.aim(L.chain[0], new THREE.Vector3(0, 1, 0), V3().subVectors(J[1], R));
        const Fr = V3().subVectors(F, R).normalize().multiplyScalar(reach).add(R);
        this.aim(L.chain[1], new THREE.Vector3(0, 1, 0), V3().subVectors(Fr, J[1]));
        this.debug[L.name] = { short: F.distanceTo(R) - reach };
      } else {
        // femur and cannon stay parallel (the hind leg's reciprocal apparatus); the tibia closes the gap
        const Vj = V3();
        const reach = twoBone(R, F, l0 + l2, l1, pole, Vj);
        const dirA = V3().subVectors(Vj, R).normalize();
        J[1].copy(R).addScaledVector(dirA, l0); // stifle
        const Fr = V3().subVectors(F, R).normalize().multiplyScalar(reach).add(R);
        J[2].copy(J[1]).add(V3().subVectors(Fr, Vj)); // hock
        this.aim(L.chain[0], new THREE.Vector3(0, 1, 0), V3().subVectors(J[1], R));
        this.aim(L.chain[1], new THREE.Vector3(0, 1, 0), V3().subVectors(J[2], J[1]));
        this.aim(L.chain[2], new THREE.Vector3(0, 1, 0), dirA);
        this.debug[L.name] = { short: F.distanceTo(R) - reach };
      }
      this.aim(L.leaf, L.contactLocal.clone().normalize(), pdir);
    }
  }

  /** The two ends of the bit now (world): left, right. */
  bit() {
    const M = new THREE.Matrix4().multiplyMatrices(this.headBone.matrixWorld, this.headRestInv);
    return this.bitRest.map((p) => p.clone().applyMatrix4(M));
  }

  /** The saddle's frame now (world): where the rider sits and how the back is tilted. */
  seat(target = V3(), quat = new THREE.Quaternion()) {
    const M = new THREE.Matrix4().multiplyMatrices(this.seatBone.matrixWorld, this.seatBoneRestInv);
    // seatBoneRestInv was taken with the model at identity: M maps native rest -> world now
    target.copy(this.seatRest).applyMatrix4(M);
    M.decompose(_p, quat, _s);
    return { pos: target, quat };
  }
}
