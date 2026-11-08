// Geometry kit for the village (used by src/world.js): metre-scaled UVs, parts batched by material
// and merged, a parametric half-timbered cottage, props, and leaf-card trees.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = (hex) => new THREE.Color(hex);
const WHITE = new THREE.Color(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Texture tile size in metres per batch key (uvs are built in metres). */
const TILE = { plaster: 2, timber: 1, roof: 2, stone: 2, wood: 2, bark: 2 };

/** Parts collected by material key; every geometry is indexed with position, normal, uv and color. */
export class Batch {
  constructor() { this.parts = {}; }
  add(key, geo, m) {
    if (m) geo.applyMatrix4(m);
    (this.parts[key] ||= []).push(geo);
    return geo;
  }
  /** Move everything from another batch into this one, transformed by m. */
  take(other, m) {
    for (const [k, list] of Object.entries(other.parts)) for (const g of list) this.add(k, g, m);
  }
  build(key) {
    const parts = this.parts[key];
    if (!parts?.length) return null;
    const g = mergeGeometries(parts);
    const k = 1 / (TILE[key] || 1);
    if (k !== 1) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    }
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------ primitive helpers
function mk(pos, nor, uv, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function paint(g, color) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function scaleUV(g, su, sv, swap = false) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i) * su, v = uv.getY(i) * sv;
    if (swap) uv.setXY(i, v, u); else uv.setXY(i, u, v);
  }
  return g;
}
/** Matrix from position + Euler (YXZ-free: x, then y, then z order as in THREE.Euler default). */
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
}

const FACES = [
  { o: [1, -1, 1], U: [0, 0, -2], V: [0, 2, 0], n: [1, 0, 0] },
  { o: [-1, -1, -1], U: [0, 0, 2], V: [0, 2, 0], n: [-1, 0, 0] },
  { o: [-1, -1, 1], U: [2, 0, 0], V: [0, 2, 0], n: [0, 0, 1] },
  { o: [1, -1, -1], U: [-2, 0, 0], V: [0, 2, 0], n: [0, 0, -1] },
  { o: [-1, 1, 1], U: [2, 0, 0], V: [0, 0, -2], n: [0, 1, 0] },
  { o: [-1, -1, -1], U: [2, 0, 0], V: [0, 0, 2], n: [0, -1, 0] },
];
/**
 * Box centred on the origin, uvs in metres. grain: u runs along each face's longer edge (wood).
 * faces: bit mask (+x, -x, +z, -z, +y, -y). bottom: colour factor at the bottom edge (soot/dirt).
 */
export function box(w, h, d, color = WHITE, { grain = false, uo = 0, vo = 0, faces = 63, bottom = 1 } = {}) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const pos = [], nor = [], uv = [], col = [], idx = [];
  FACES.forEach((f, fi) => {
    if (!(faces & (1 << fi))) return;
    const o = [f.o[0] * hx, f.o[1] * hy, f.o[2] * hz];
    const U = [f.U[0] * hx, f.U[1] * hy, f.U[2] * hz], V = [f.V[0] * hx, f.V[1] * hy, f.V[2] * hz];
    const lu = Math.hypot(U[0], U[1], U[2]), lv = Math.hypot(V[0], V[1], V[2]);
    const swap = grain && lv > lu;
    const b0 = pos.length / 3;
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const px = o[0] + U[0] * a + V[0] * b, py = o[1] + U[1] * a + V[1] * b, pz = o[2] + U[2] * a + V[2] * b;
      pos.push(px, py, pz);
      nor.push(f.n[0], f.n[1], f.n[2]);
      if (swap) uv.push(b * lv + uo, a * lu + vo); else uv.push(a * lu + uo, b * lv + vo);
      const k = bottom === 1 ? 1 : bottom + (1 - bottom) * ((py + hy) / (2 * hy || 1));
      col.push(color.r * k, color.g * k, color.b * k);
    }
    idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  });
  return mk(pos, nor, uv, col, idx);
}

/** Cylinder with uvs in metres (u around, v along). */
export function cyl(rt, rb, h, seg, color = WHITE, { open = false, swap = false } = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  scaleUV(g, Math.PI * (rt + rb), h, swap);
  return paint(g, color);
}

/** Quad from four corners (counter-clockwise seen from the front) with given uvs (metres). */
export function quad(p, uvs, color = WHITE, flip = false) {
  const a = new THREE.Vector3(...p[0]), b = new THREE.Vector3(...p[1]), c = new THREE.Vector3(...p[2]);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  if (flip) n.negate();
  const pos = p.flat(), nor = [], col = [];
  for (let i = 0; i < 4; i++) { nor.push(n.x, n.y, n.z); col.push(color.r, color.g, color.b); }
  return mk(pos, nor, uvs.flat(), col, flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
}
export function tri(p, uvs, color = WHITE) {
  const a = new THREE.Vector3(...p[0]), b = new THREE.Vector3(...p[1]), c = new THREE.Vector3(...p[2]);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  const nor = [], col = [];
  for (let i = 0; i < 3; i++) { nor.push(n.x, n.y, n.z); col.push(color.r, color.g, color.b); }
  return mk(p.flat(), nor, uvs.flat(), col, [0, 1, 2]);
}

/** A smooth blob (icosphere), for produce, flowers in boxes, distant bushes. */
export function blob(r, color, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const m = g.index ? g : mergeVerticesLite(g);
  return paint(m, color);
}
function mergeVerticesLite(g) {
  // IcosahedronGeometry is non-indexed: weld it so normals are smooth and it merges with indexed parts
  const p = g.attributes.position, uvA = g.attributes.uv;
  const map = new Map(), pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = pos.length / 3;
      map.set(key, k);
      pos.push(x, y, z);
      const l = Math.hypot(x, y, z) || 1;
      nor.push(x / l, y / l, z / l);
      uv.push(uvA.getX(i), uvA.getY(i));
    }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// --------------------------------------------------------------------------------- the cottage
// Colours are multipliers on the textures (vertex colours).
export const PALETTE = {
  walls: ['#fff6e6', '#f6e7c8', '#f3ddd0', '#eef0e6', '#f7e2bd', '#e9e4da'].map(C),
  roofs: ['#c0603f', '#5f7fb0', '#9a6a48', '#b84f40', '#4f8a7a', '#86659a', '#a8784a', '#4f6fa0'].map(C),
  shutters: ['#3f6f8f', '#4f7a4a', '#8a3f3a', '#2f5f62', '#6a4a7a'].map(C),
  timber: C('#ffffff'),
};

/** Wall frames: s along the wall, n out of it. */
function walls(W, D) {
  return [
    { o: new THREE.Vector3(-W / 2, 0, D / 2), s: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1), len: W, side: 'front' },
    { o: new THREE.Vector3(W / 2, 0, -D / 2), s: new THREE.Vector3(-1, 0, 0), n: new THREE.Vector3(0, 0, -1), len: W, side: 'back' },
    { o: new THREE.Vector3(W / 2, 0, D / 2), s: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0), len: D, side: 'right' },
    { o: new THREE.Vector3(-W / 2, 0, -D / 2), s: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-1, 0, 0), len: D, side: 'left' },
  ];
}
function wallM(wl, s, y, n) {
  const m = new THREE.Matrix4().makeBasis(wl.s, UP, wl.n);
  m.setPosition(wl.o.clone().addScaledVector(wl.s, s).addScaledVector(UP, y).addScaledVector(wl.n, n));
  return m;
}

/**
 * A half-timbered cottage. Local space: ground at y = 0, front (door) facing +z, width w along x.
 * Returns the parts in a Batch plus anchors (chimney top, door lamp, sign) in local space.
 */
export function cottage(r, o) {
  const B = new Batch();
  const { w, d, floors, groundStone, ridgeAlongX, pitch, wall: wallC, roof: roofC, shutter } = o;
  const P = 0.55; // plinth top
  const h1 = o.h1 ?? 2.75, h2 = o.h2 ?? 2.45, jet = floors > 1 ? (o.jetty ?? 0.35) : 0;
  const top1 = P + h1, top = floors > 1 ? top1 + h2 : top1;
  const anchors = { lamps: [], smoke: null, glow: [] };
  const hidden = o.hidden || new Set();
  const tim = PALETTE.timber.clone().multiplyScalar(0.85 + r() * 0.3);
  const plasterC = wallC.clone();
  const stoneC = new THREE.Color(1, 1, 1).multiplyScalar(0.9 + r() * 0.15);

  // plinth, sunk into the ground so slopes never show a gap
  B.add('stone', box(w + 0.24, P + 0.6, d + 0.24, stoneC, { bottom: 0.65, faces: 31 }), M(0, (P - 0.6) / 2, 0));
  // ground floor body
  if (groundStone) B.add('stone', box(w, h1, d, stoneC, { bottom: 0.8, faces: 15 }), M(0, P + h1 / 2, 0));
  else B.add('plaster', box(w - 0.02, h1, d - 0.02, plasterC, { bottom: 0.8, faces: 15 }), M(0, P + h1 / 2, 0));
  // upper floor, jettied out front and back
  const D2 = d + 2 * jet;
  if (floors > 1) {
    B.add('plaster', box(w - 0.02, h2, D2 - 0.02, plasterC, { faces: 47 }), M(0, top1 + h2 / 2, 0));
    // joist ends under the jetty
    for (const sz of hidden.has('back') ? [1] : [-1, 1]) for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.55) {
      B.add('timber', box(0.13, 0.14, jet + 0.12, tim, { grain: true, uo: x, faces: 47 }), M(x, top1 - 0.07, sz * (d / 2 + jet / 2 - 0.02)));
    }
    B.add('timber', box(w + 0.06, 0.2, 0.16, tim, { grain: true }), M(0, top1 + 0.06, D2 / 2 - 0.04));
    B.add('timber', box(w + 0.06, 0.2, 0.16, tim, { grain: true }), M(0, top1 + 0.06, -D2 / 2 + 0.04));
  }

  // ---- timber framing, doors and windows on each wall of each storey
  const storeys = [{ y0: P, y1: top1, W: w, D: d, ground: true }];
  if (floors > 1) storeys.push({ y0: top1, y1: top, W: w, D: D2, ground: false });
  const doorWall = 'front';
  let doorDone = false;
  for (const st of storeys) {
    for (const wl of walls(st.W, st.D)) {
      if (hidden.has(wl.side)) continue; // never faces the camera
      const stoneHere = st.ground && groundStone;
      const L = wl.len;
      const hgt = st.y1 - st.y0;
      // bays
      const nb = Math.max(2, Math.round(L / 1.6));
      const bw = L / nb;
      const plan = [];
      for (let k = 0; k < nb; k++) plan.push('plain');
      const isFront = wl.side === doorWall;
      const isEnd = wl.side === 'left' || wl.side === 'right';
      let doorBay = -1;
      if (st.ground && isFront && !doorDone) {
        doorBay = o.doorBay ?? Math.min(nb - 1, Math.max(0, Math.floor(nb / 2) + (r() < 0.5 ? -1 : 0)));
        plan[doorBay] = 'door';
        doorDone = true;
      }
      for (let k = 0; k < nb; k++) {
        if (plan[k] !== 'plain') continue;
        const winP = wl.side === 'back' ? 0.25 : isEnd ? 0.5 : 0.62;
        if (Math.abs(k - doorBay) === 1 && r() < 0.5) continue;
        if (r() < winP) plan[k] = 'window';
        else if (!st.ground || r() < 0.5) plan[k] = r() < 0.5 ? 'brace' : 'cross';
      }
      if (!stoneHere) {
        // posts, sill and plate
        for (let k = 0; k <= nb; k++) {
          const s = Math.min(L - 0.1, Math.max(0.1, k * bw));
          const corner = k === 0 || k === nb;
          B.add('timber', box(corner ? 0.24 : 0.17, hgt, 0.1, tim, { grain: true, uo: k * 0.37, faces: 7 }), wallM(wl, s, st.y0 + hgt / 2, 0.01));
        }
        B.add('timber', box(L + 0.04, 0.2, 0.12, tim, { grain: true, faces: 53 }), wallM(wl, L / 2, st.y0 + 0.1, 0.012));
        B.add('timber', box(L + 0.04, 0.2, 0.12, tim, { grain: true, uo: 0.5, faces: 53 }), wallM(wl, L / 2, st.y1 - 0.1, 0.012));
      }
      for (let k = 0; k < nb; k++) {
        const s0 = k * bw, s1 = (k + 1) * bw, sc = (s0 + s1) / 2;
        const inner = bw - 0.17;
        const kind = plan[k];
        if (kind === 'door') {
          const dw = Math.min(1.05, bw - 0.3), dh = 2.05;
          const dy = st.y0;
          B.add('wood', box(dw, dh, 0.06, o.doorColor, { grain: true }), wallM(wl, sc, dy + dh / 2, 0.0));
          // frame
          B.add('timber', box(0.13, dh + 0.1, 0.14, tim, { grain: true }), wallM(wl, sc - dw / 2 - 0.06, dy + dh / 2, 0.03));
          B.add('timber', box(0.13, dh + 0.1, 0.14, tim, { grain: true }), wallM(wl, sc + dw / 2 + 0.06, dy + dh / 2, 0.03));
          B.add('timber', box(dw + 0.4, 0.18, 0.16, tim, { grain: true }), wallM(wl, sc, dy + dh + 0.09, 0.035));
          // iron straps and a ring
          for (const yy of [0.35, 1.65]) B.add('iron', box(dw * 0.8, 0.05, 0.02, C('#26221f')), wallM(wl, sc - dw * 0.08, dy + yy, 0.04));
          B.add('iron', cyl(0.035, 0.035, 0.02, 10, C('#2a2622')), wallM(wl, sc + dw * 0.32, dy + 1.0, 0.045).multiply(M(0, 0, 0, Math.PI / 2)));
          // stone steps down to the ground
          B.add('stone', box(dw + 0.5, 0.28, 0.42, stoneC), wallM(wl, sc, 0.14, 0.3));
          B.add('stone', box(dw + 0.35, 0.27, 0.26, stoneC), wallM(wl, sc, 0.415, 0.13));
          // a lantern by the door
          const ls = sc + (dw / 2 + 0.38) * (r() < 0.5 ? -1 : 1);
          B.add('iron', box(0.05, 0.05, 0.3, C('#26221f')), wallM(wl, ls, dy + 2.05, 0.15));
          B.add('iron', box(0.22, 0.04, 0.22, C('#26221f')), wallM(wl, ls, dy + 2.0, 0.3));
          B.add('glow', box(0.15, 0.22, 0.15, C('#ffc070').multiplyScalar(1.6)), wallM(wl, ls, dy + 1.86, 0.3));
          B.add('iron', box(0.2, 0.04, 0.2, C('#26221f')), wallM(wl, ls, dy + 1.74, 0.3));
          anchors.lamps.push(new THREE.Vector3(0, dy + 1.86, 0).applyMatrix4(wallM(wl, ls, 0, 0.3)));
          anchors.door = { wl, s: sc, w: dw, y: dy, pos: new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, sc, 0, 0.5)), lamp: ls };
          continue;
        }
        if (kind === 'window') {
          const ww = Math.min(st.ground ? 0.95 : 0.85, inner - 0.12);
          const wh = st.ground ? 1.15 : 1.0;
          const wy = st.ground ? st.y0 + 0.95 + wh / 2 : st.y0 + 0.75 + wh / 2;
          const lit = r() < (o.litChance ?? 0.55);
          const gc = lit ? C('#ffb45c').multiplyScalar(1.45 + r() * 0.3) : C('#5b6680').multiplyScalar(0.55);
          B.add(lit ? 'glass' : 'darkglass', quad([[-ww / 2, -wh / 2, 0], [ww / 2, -wh / 2, 0], [ww / 2, wh / 2, 0], [-ww / 2, wh / 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], gc), wallM(wl, sc, wy, 0.004));
          if (lit) anchors.glow.push(new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, sc, wy, 0.1)));
          // frame + sill
          B.add('timber', box(ww + 0.16, 0.09, 0.09, tim, { grain: true, faces: 55 }), wallM(wl, sc, wy + wh / 2 + 0.045, 0.03));
          B.add('timber', box(0.08, wh, 0.08, tim, { grain: true, faces: 7 }), wallM(wl, sc - ww / 2 - 0.04, wy, 0.03));
          B.add('timber', box(0.08, wh, 0.08, tim, { grain: true, faces: 7 }), wallM(wl, sc + ww / 2 + 0.04, wy, 0.03));
          B.add('timber', box(ww + 0.26, 0.07, 0.17, tim, { grain: true, faces: 55 }), wallM(wl, sc, wy - wh / 2 - 0.035, 0.07));
          // rails above and below (part of the frame)
          if (!stoneHere) {
            B.add('timber', box(inner, 0.13, 0.12, tim, { grain: true, faces: 52 }), wallM(wl, sc, wy - wh / 2 - 0.12, 0.012));
            B.add('timber', box(inner, 0.13, 0.12, tim, { grain: true, faces: 52 }), wallM(wl, sc, wy + wh / 2 + 0.12, 0.012));
          }
          // shutters
          if (shutter && r() < 0.5 && plan[k - 1] !== 'window' && plan[k + 1] !== 'window') {
            for (const sx of [-1, 1]) B.add('wood', box(ww * 0.42, wh + 0.04, 0.04, shutter, { grain: true, uo: sx }), wallM(wl, sc + sx * (ww * 0.71 + 0.1), wy, 0.1));
          }
          // flower box
          if (r() < (st.ground ? 0.45 : 0.3) && wl.side !== 'back') {
            B.add('wood', box(ww + 0.2, 0.2, 0.22, C('#8a6a4a'), { grain: true }), wallM(wl, sc, wy - wh / 2 - 0.17, 0.14));
            const fcols = ['#e8455a', '#f2a2c0', '#ffffff', '#f6c042', '#c46ad8', '#ff7a3a'];
            const fc = C(fcols[Math.floor(r() * fcols.length)]);
            for (let f = 0; f < 9; f++) {
              const leaf = f % 3 === 0;
              const g = blob(leaf ? 0.08 : 0.065, leaf ? C('#3f6a2a') : fc.clone().multiplyScalar(0.85 + r() * 0.3), 0);
              B.add('flowers3d', g, wallM(wl, sc - ww / 2 + (f + 0.5) * (ww / 9), wy - wh / 2 - 0.05 + r() * 0.06, 0.15 + (r() - 0.5) * 0.1));
            }
          }
          continue;
        }
        if (stoneHere) continue;
        if (kind === 'brace' || kind === 'cross') {
          const hh = hgt - 0.4, ww = inner;
          const len = Math.hypot(ww, hh), ang = Math.atan2(hh, ww);
          const dirs = kind === 'cross' ? [1, -1] : [(k % 2 ? 1 : -1)];
          for (const sgn of dirs) B.add('timber', box(len, 0.15, 0.09, tim, { grain: true, uo: k, faces: 55 }), wallM(wl, sc, st.y0 + 0.2 + hh / 2, 0.005).multiply(M(0, 0, 0, 0, 0, sgn * ang)));
        } else {
          B.add('timber', box(inner, 0.14, 0.12, tim, { grain: true, uo: k * 0.3, faces: 52 }), wallM(wl, sc, st.y0 + hgt * 0.52, 0.012));
        }
      }
    }
  }

  // ---- roof (built with the ridge along x, then turned if the ridge runs front to back)
  const RW = ridgeAlongX ? w : D2, RD = ridgeAlongX ? D2 : w;
  const rot = ridgeAlongX ? new THREE.Matrix4() : M(0, 0, 0, 0, Math.PI / 2, 0);
  const R = new Batch();
  const tan = Math.tan(pitch);
  const rh = (RD / 2) * tan;
  const over = 0.5, gx = 0.4, th = 0.16;
  const ridgeY = top + rh;
  const slopeLen = Math.hypot(RD / 2 + over, (RD / 2 + over) * tan);
  const roofTint = roofC.clone();
  for (const sz of [-1, 1]) {
    const ez = sz * (RD / 2 + over), ey = top - over * tan;
    const nrm = new THREE.Vector3(0, Math.cos(pitch), sz * Math.sin(pitch));
    const lift = nrm.clone().multiplyScalar(th);
    const p0 = [-RW / 2 - gx, ridgeY, 0], p1 = [RW / 2 + gx, ridgeY, 0], p2 = [RW / 2 + gx, ey, ez], p3 = [-RW / 2 - gx, ey, ez];
    const L = (p) => [p[0] + lift.x, p[1] + lift.y, p[2] + lift.z];
    const uvs = [[0, 0], [RW + 2 * gx, 0], [RW + 2 * gx, slopeLen], [0, slopeLen]];
    // top (shingles): counter-clockwise from outside
    const topQ = sz > 0 ? [L(p0), L(p3), L(p2), L(p1)] : [L(p1), L(p2), L(p3), L(p0)];
    const topUV = sz > 0 ? [uvs[0], uvs[3], uvs[2], uvs[1]] : [uvs[1], uvs[2], uvs[3], uvs[0]];
    R.add('roof', quad(topQ, topUV, roofTint.clone().multiplyScalar(0.92 + r() * 0.12)));
    // underside (boards), facing down
    const botQ = sz > 0 ? [p0, p1, p2, p3] : [p1, p0, p3, p2];
    R.add('wood', quad(botQ, [[0, 0], [RW, 0], [RW, slopeLen], [0, slopeLen]], C('#6b5848')));
    // fascia along the eave
    R.add('timber', quad(sz > 0 ? [p3, p2, L(p2), L(p3)] : [p2, p3, L(p3), L(p2)], [[0, 0], [RW, 0], [RW, th], [0, th]], tim));
    // barge boards along the gable edges
    for (const sx of [-1, 1]) {
      const x = sx * (RW / 2 + gx);
      const a = [x, ridgeY + th + 0.05, 0], b = [x, ey + th * 0.4, ez + sz * 0.04], c = [x, ey - 0.16, ez + sz * 0.04], dd = [x, ridgeY - 0.2, 0];
      const q = (sx > 0) === (sz > 0) ? [a, b, c, dd] : [b, a, dd, c];
      R.add('timber', quad(q, [[0, 0], [slopeLen, 0], [slopeLen, 0.3], [0, 0.3]], tim));
    }
  }
  // ridge cap
  R.add('roof', box(RW + 2 * gx + 0.08, 0.14, 0.3, roofTint.clone().multiplyScalar(0.7), { faces: 63 }), M(0, ridgeY + th + 0.03, 0));
  // gable triangles, plaster with a king post and struts
  for (const sx of [-1, 1]) {
    const x = sx * RW / 2;
    // which house wall this gable sits on (the roof may be turned), to skip framing that never shows
    const gside = ridgeAlongX ? (sx > 0 ? 'right' : 'left') : (sx > 0 ? 'back' : 'front');
    const a = [x, top, -RD / 2], b = [x, top, RD / 2], c = [x, ridgeY, 0];
    const q = sx > 0 ? [b, a, c] : [a, b, c];
    const uq = sx > 0 ? [[RD, 0], [0, 0], [RD / 2, rh]] : [[0, 0], [RD, 0], [RD / 2, rh]];
    R.add('plaster', tri(q, uq, plasterC));
    if (hidden.has(gside)) continue;
    const gm = (y, z, rz) => M(x + sx * 0.02, y, z, 0, Math.PI / 2, rz);
    R.add('timber', box(0.16, rh - 0.1, 0.1, tim, { grain: true }), gm(top + (rh - 0.1) / 2, 0, 0));
    R.add('timber', box(RD - 0.1, 0.16, 0.1, tim, { grain: true }), gm(top + 0.08, 0, 0));
    const cy = top + rh * 0.45;
    R.add('timber', box(RD * 0.55 * 0.95, 0.14, 0.1, tim, { grain: true }), gm(cy, 0, 0));
    if (rh > 2.0 && r() < 0.6) {
      // a small gable window
      const gw = 0.55, gh = 0.7;
      const lit = r() < 0.5;
      const gc = lit ? C('#ffb45c').multiplyScalar(1.4) : C('#5b6680').multiplyScalar(0.55);
      const wq = quad([[-gw / 2, -gh / 2, 0], [gw / 2, -gh / 2, 0], [gw / 2, gh / 2, 0], [-gw / 2, gh / 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], gc);
      R.add(lit ? 'glass' : 'darkglass', wq, M(x + sx * 0.015, top + rh * 0.24 + 0.1, RD * 0.22, 0, sx * Math.PI / 2, 0));
      R.add('timber', box(gw + 0.14, 0.07, 0.12, tim, { grain: true }), M(x + sx * 0.04, top + rh * 0.24 + 0.1 - gh / 2 - 0.03, RD * 0.22, 0, Math.PI / 2, 0));
    }
  }
  // chimney through the roof
  const chx = (r() < 0.5 ? -1 : 1) * (RW / 2 - 0.75), chz = (r() < 0.5 ? -1 : 1) * Math.min(RD * 0.18, 0.9);
  const chTop = ridgeY + 0.9 + r() * 0.5;
  R.add('stone', box(0.72, chTop - top + 0.4, 0.72, stoneC), M(chx, (chTop + top - 0.4) / 2, chz));
  R.add('stone', box(0.88, 0.14, 0.88, stoneC.clone().multiplyScalar(0.85)), M(chx, chTop + 0.07, chz));
  R.add('roof', cyl(0.13, 0.15, 0.32, 10, C('#c46a4a')), M(chx, chTop + 0.3, chz));
  anchors.smoke = new THREE.Vector3(chx, chTop + 0.48, chz).applyMatrix4(rot);
  B.take(R, rot);

  // ---- a hanging sign and an awning on shops
  if (o.sign != null && anchors.door) {
    const { wl, s } = anchors.door;
    const ss = s + (s > wl.len / 2 ? -1.15 : 1.15);
    B.add('iron', box(0.05, 0.05, 1.05, C('#26221f')), wallM(wl, ss, P + 2.75, 0.52));
    B.add('iron', box(0.03, 0.4, 0.03, C('#26221f')), wallM(wl, ss, P + 2.55, 0.97).multiply(M(0, 0, 0, 0.5, 0, 0)));
    for (const dz of [0.25, 0.85]) B.add('iron', box(0.015, 0.14, 0.015, C('#3a3530')), wallM(wl, ss, P + 2.66, dz));
    const sg = box(0.04, 0.42, 0.72, WHITE, { faces: 0b000011 });
    // uvs to the sign atlas cell
    const cell = o.sign % 4, cu = (cell % 2) * 0.5, cv = Math.floor(cell / 2) * 0.5;
    const uv = sg.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      // faces are 0.72 (u, along z) x 0.42 (v); map to the cell; the -x face is mirrored so flip u there
      const u = uv.getX(i) / 0.72, v = uv.getY(i) / 0.42;
      uv.setXY(i, cu + u * 0.5, cv + (1 - v) * 0.5);
    }
    B.add('sign', sg, wallM(wl, ss, P + 2.36, 0.56));
    B.add('wood', box(0.06, 0.46, 0.78, C('#5a4030'), { faces: 0b111100, grain: true }), wallM(wl, ss, P + 2.36, 0.56));
  }
  if (o.awning && anchors.door) {
    const { wl, s, w: dw } = anchors.door;
    const aw = dw + 1.3, depth = 0.95, y0 = P + 2.5;
    const q = quad([[-aw / 2, -0.55, depth], [aw / 2, -0.55, depth], [aw / 2, 0, 0], [-aw / 2, 0, 0]], [[0, 1], [1, 1], [1, 0], [0, 0]], WHITE);
    B.add('awning', q, wallM(wl, s, y0, 0.02));
    for (const sx of [-1, 1]) B.add('iron', box(0.03, 0.03, 1.1, C('#26221f')), wallM(wl, s + sx * aw / 2 * 0.95, y0 - 0.28, 0.48).multiply(M(0, 0, 0, Math.atan2(0.55, depth), 0, 0)));
  }
  return { B, anchors, height: ridgeY + th };
}

// ------------------------------------------------------------------------------------------ props
export function lampPost(B, m, r) {
  // kept low (lantern at 2.2 m) so near posts stay under the title screens
  const iron = C('#23211f');
  B.add('stone', box(0.34, 0.4, 0.34, WHITE.clone().multiplyScalar(0.85), { bottom: 0.6 }), m.clone().multiply(M(0, 0.12, 0)));
  B.add('iron', cyl(0.045, 0.06, 2.25, 6, iron, { open: true }), m.clone().multiply(M(0, 1.45, 0)));
  B.add('iron', cyl(0.08, 0.08, 0.12, 6, iron, { open: true }), m.clone().multiply(M(0, 0.38, 0)));
  // arm and hanging lantern
  B.add('iron', box(0.62, 0.05, 0.05, iron), m.clone().multiply(M(0.27, 2.52, 0)));
  B.add('iron', box(0.04, 0.32, 0.04, iron), m.clone().multiply(M(0.12, 2.38, 0, 0, 0, -0.7)));
  const lx = 0.52, ly = 2.17;
  B.add('iron', cyl(0.02, 0.17, 0.14, 4, iron), m.clone().multiply(M(lx, ly + 0.21, 0, 0, Math.PI / 4, 0)));
  for (const [dx, dz] of [[-1, -1], [1, 1]]) B.add('iron', box(0.025, 0.3, 0.025, iron, { faces: 15 }), m.clone().multiply(M(lx + dx * 0.085, ly, dz * 0.085)));
  B.add('iron', box(0.2, 0.035, 0.2, iron), m.clone().multiply(M(lx, ly - 0.16, 0)));
  B.add('glow', box(0.14, 0.27, 0.14, C('#ffc27a').multiplyScalar(1.8)), m.clone().multiply(M(lx, ly, 0)));
  return new THREE.Vector3(lx, ly, 0).applyMatrix4(m);
}

export function fence(B, m, len, r) {
  const wood = WHITE.clone().multiplyScalar(0.8 + r() * 0.2);
  const n = Math.max(1, Math.round(len / 1.5));
  for (let k = 0; k <= n; k++) {
    const x = -len / 2 + (k / n) * len;
    B.add('wood', box(0.1, 1.0, 0.1, wood, { grain: true, uo: k }), m.clone().multiply(M(x, 0.42, 0, 0, 0, (r() - 0.5) * 0.06)));
  }
  for (const y of [0.42, 0.8]) B.add('wood', box(len + 0.1, 0.09, 0.05, wood, { grain: true, uo: y }), m.clone().multiply(M(0, y, 0.06, 0, 0, (r() - 0.5) * 0.02)));
}

export function barrel(B, m, r) {
  const pts = [];
  for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(new THREE.Vector2(0.3 + 0.06 * Math.sin(t * Math.PI), t * 0.9)); }
  const g = new THREE.LatheGeometry(pts, 12);
  scaleUV(g, Math.PI * 0.66, 0.9, true);
  B.add('wood', paint(g, WHITE.clone().multiplyScalar(0.75 + r() * 0.25)), m.clone());
  B.add('wood', cyl(0.29, 0.29, 0.02, 12, C('#8a7058')), m.clone().multiply(M(0, 0.89, 0)));
  for (const y of [0.13, 0.77]) B.add('iron', cyl(0.335, 0.335, 0.05, 12, C('#2c2a28'), { open: true }), m.clone().multiply(M(0, y, 0)));
}

export function crate(B, m, r, s = 0.6) {
  const c = WHITE.clone().multiplyScalar(0.85 + r() * 0.2);
  B.add('wood', box(s, s, s, c, { grain: true, uo: r() }), m.clone().multiply(M(0, s / 2, 0)));
  const e = 0.06, t = C('#8a7058');
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.add('timber', box(e, s + 0.01, e, t, { grain: true }), m.clone().multiply(M(x * (s / 2 - e / 2 + 0.01), s / 2, z * (s / 2 - e / 2 + 0.01))));
  for (const y of [e / 2, s - e / 2]) for (const [x, z, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    B.add('timber', box(s, e, e, t, { grain: true }), m.clone().multiply(M(x * (s / 2 - e / 2 + 0.012), y, z * (s / 2 - e / 2 + 0.012), 0, ry, 0)));
  }
}

/** A burlap sack: bulging body, tied neck and a tuft, a little lumpy. */
export function sack(B, m, r) {
  const prof = [[0, 0], [0.22, 0.01], [0.29, 0.1], [0.3, 0.27], [0.27, 0.42], [0.18, 0.53], [0.08, 0.6], [0.06, 0.64], [0.1, 0.7], [0.05, 0.74], [0, 0.74]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const p = g.attributes.position;
  const k1 = r() * 6, k2 = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + 0.06 * Math.sin(x * 9 + k1) * Math.sin(z * 8 + k2) + 0.04 * Math.sin(y * 14 + k1);
    p.setXYZ(i, x * f * 1.1, y * (0.9 + 0.1 * Math.sin(k2)), z * f * 0.85);
  }
  g.computeVertexNormals();
  B.add('cloth3d', paint(g, C('#b9a37a').multiplyScalar(0.85 + r() * 0.2)), m.clone().multiply(M(0, 0, 0, 0, r() * 6, (r() - 0.5) * 0.15)));
}

export function stall(B, m, r) {
  const wood = WHITE.clone().multiplyScalar(0.9);
  B.add('wood', box(2.6, 0.95, 1.0, wood, { grain: true }), m.clone().multiply(M(0, 0.475, 0)));
  B.add('timber', box(2.75, 0.07, 1.15, WHITE, { grain: true }), m.clone().multiply(M(0, 0.98, 0)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.11, sz > 0 ? 2.2 : 2.6, 0.11, WHITE, { grain: true }), m.clone().multiply(M(sx * 1.25, sz > 0 ? 1.1 : 1.3, sz * 0.45)));
  const q = quad([[-1.55, 2.2, 0.95], [1.55, 2.2, 0.95], [1.55, 2.65, -0.55], [-1.55, 2.65, -0.55]], [[0, 1], [1, 1], [1, 0], [0, 0]], WHITE);
  B.add('awning', q, m.clone());
  // produce in crates on the counter
  const fruit = ['#d8402e', '#f29a2e', '#8fbf3a', '#f2cf3a', '#7a2a4a'];
  for (let k = 0; k < 4; k++) {
    const cx = -0.95 + k * 0.63;
    B.add('wood', box(0.55, 0.16, 0.5, C('#a07a52'), { grain: true }), m.clone().multiply(M(cx, 1.09, 0.05)));
    const fc = C(fruit[k % fruit.length]);
    for (let f = 0; f < 10; f++) B.add('produce', blob(0.065, fc.clone().multiplyScalar(0.8 + r() * 0.35), 0), m.clone().multiply(M(cx - 0.2 + (f % 5) * 0.1, 1.2 + Math.floor(f / 5) * 0.04, -0.08 + Math.floor(f / 5) * 0.22 + (r() - 0.5) * 0.04)));
  }
  crate(B, m.clone().multiply(M(1.7, 0, 0.3, 0, 0.3, 0)), r, 0.55);
  sack(B, m.clone().multiply(M(1.75, 0, -0.45)), r);
  barrel(B, m.clone().multiply(M(-1.75, 0, 0.1)), r);
}

export function well(B, m, r) {
  const ring = new THREE.CylinderGeometry(0.95, 1.0, 0.9, 24, 1, true);
  scaleUV(ring, Math.PI * 1.95, 0.9);
  B.add('stone', paint(ring, WHITE), m.clone().multiply(M(0, 0.45, 0)));
  const inner = new THREE.CylinderGeometry(0.75, 0.75, 0.9, 24, 1, true);
  inner.scale(-1, 1, 1); // inside faces
  const inN = inner.attributes.normal;
  for (let i = 0; i < inN.count; i++) inN.setXYZ(i, -inN.getX(i), -inN.getY(i), -inN.getZ(i));
  scaleUV(inner, Math.PI * 1.5, 0.9);
  B.add('stone', paint(inner, WHITE.clone().multiplyScalar(0.5)), m.clone().multiply(M(0, 0.45, 0)));
  const rim = new THREE.RingGeometry(0.72, 1.08, 24, 1);
  rim.rotateX(-Math.PI / 2);
  scaleUV(rim, 2, 2);
  B.add('stone', paint(rim, WHITE.clone().multiplyScalar(0.9)), m.clone().multiply(M(0, 0.92, 0)));
  B.add('iron', paint(new THREE.CircleGeometry(0.75, 20).rotateX(-Math.PI / 2), C('#1a2430')), m.clone().multiply(M(0, 0.55, 0)));
  for (const sx of [-1, 1]) B.add('timber', box(0.14, 2.1, 0.14, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.92, 1.45, 0)));
  B.add('timber', cyl(0.06, 0.06, 2.0, 10, WHITE, { swap: true }), m.clone().multiply(M(0, 2.05, 0, 0, 0, Math.PI / 2)));
  // little roof
  const tan = Math.tan(0.7), RD = 1.6, rh = RD / 2 * tan;
  for (const sz of [-1, 1]) {
    const p0 = [-1.3, 2.55 + rh, 0], p1 = [1.3, 2.55 + rh, 0], p2 = [1.3, 2.55 - 0.1, sz * (RD / 2 + 0.15)], p3 = [-1.3, 2.55 - 0.1, sz * (RD / 2 + 0.15)];
    const sl = Math.hypot(RD / 2 + 0.15, rh + 0.1);
    const qq = sz > 0 ? [p0, p3, p2, p1] : [p1, p2, p3, p0];
    B.add('roof', quad(qq, sz > 0 ? [[0, 0], [0, sl], [2.6, sl], [2.6, 0]] : [[2.6, 0], [2.6, sl], [0, sl], [0, 0]], C('#a8584a')), m.clone());
    B.add('wood', quad(sz > 0 ? [p0, p1, p2, p3] : [p1, p0, p3, p2], [[0, 0], [2.6, 0], [2.6, sl], [0, sl]], C('#6b5848')), m.clone());
  }
  B.add('wood', cyl(0.13, 0.11, 0.24, 12, C('#8a6a4a')), m.clone().multiply(M(0.25, 1.6, 0)));
}

export function cart(B, m, r) {
  B.add('wood', box(1.45, 0.08, 2.3, WHITE, { grain: true }), m.clone().multiply(M(0, 0.78, 0)));
  for (const sx of [-1, 1]) B.add('wood', box(0.06, 0.38, 2.3, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.72, 0.99, 0)));
  for (const sz of [-1, 1]) B.add('wood', box(1.45, 0.38, 0.06, WHITE, { grain: true }), m.clone().multiply(M(0, 0.99, sz * 1.13)));
  for (const sx of [-1, 1]) {
    const rim = new THREE.TorusGeometry(0.44, 0.045, 8, 28);
    scaleUV(rim, 2.8, 0.3);
    B.add('timber', paint(rim, WHITE), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, 0, Math.PI / 2, 0)));
    for (let k = 0; k < 8; k++) B.add('timber', box(0.04, 0.82, 0.04, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, (k / 8) * Math.PI, 0, 0)));
    B.add('timber', cyl(0.08, 0.08, 0.16, 10, WHITE), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, 0, 0, Math.PI / 2)));
    B.add('timber', box(0.07, 0.07, 1.7, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.36, 0.62, 1.95, 0.12, 0, 0)));
  }
  B.add('timber', cyl(0.05, 0.05, 1.8, 8, WHITE, { swap: true }), m.clone().multiply(M(0, 0.46, 0.25, 0, 0, Math.PI / 2)));
  // a load of sacks and a crate
  for (let k = 0; k < 3; k++) sack(B, m.clone().multiply(M(-0.35 + (k % 2) * 0.6, 0.55, -0.5 + k * 0.42, 0, r() * 3, 0)), r);
  crate(B, m.clone().multiply(M(0.25, 0.82, 0.55, 0, 0.4, 0)), r, 0.5);
}

export function bannerPole(B, m) {
  B.add('timber', cyl(0.055, 0.07, 4.3, 10, WHITE), m.clone().multiply(M(0, 2.15, 0)));
  B.add('timber', box(1.05, 0.07, 0.07, WHITE, { grain: true }), m.clone().multiply(M(0.42, 3.95, 0)));
  B.add('glow', cyl(0.0, 0.09, 0.2, 8, C('#e8b866')), m.clone().multiply(M(0, 4.42, 0)));
}

export function woodpile(B, m, r, len = 1.8) {
  for (let row = 0; row < 4; row++) for (let k = 0; k < 7 - row; k++) {
    const rr = 0.09 + r() * 0.03;
    const g = cyl(rr, rr, 0.55 + r() * 0.1, 9, WHITE.clone().multiplyScalar(0.8 + r() * 0.25));
    B.add('bark', g, m.clone().multiply(M(-len / 2 + 0.15 + (k + row * 0.5) * 0.24, 0.1 + row * 0.19, (r() - 0.5) * 0.06, Math.PI / 2, 0, 0)));
  }
}

export function bench(B, m, r) {
  B.add('wood', box(1.6, 0.06, 0.38, WHITE, { grain: true }), m.clone().multiply(M(0, 0.45, 0)));
  for (const sx of [-1, 1]) B.add('wood', box(0.08, 0.45, 0.34, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.65, 0.22, 0)));
}

// ------------------------------------------------------------------------------------------ trees
/**
 * Leaf cards over a set of clusters ({ c, rad }): cards mostly near each cluster's surface, facing
 * outward with a random roll, carrying a soft normal from the canopy centre and an AO tint (darker low
 * and inside).
 */
export function leafCards(r, cl, cardSize, density, centre) {
  let minY = Infinity, maxY = -Infinity;
  for (const { c, rad } of cl) { minY = Math.min(minY, c.y - rad); maxY = Math.max(maxY, c.y + rad); }
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const tmp = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (const { c, rad } of cl) {
    const n = Math.round(4 * Math.PI * rad * rad / (cardSize * cardSize) * 1.1 * density) + 3;
    for (let k = 0; k < n; k++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const dirv = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
      const p = c.clone().addScaledVector(dirv, rad * (0.55 + 0.45 * Math.pow(r(), 0.5)));
      const nrm = dirv.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.2)).normalize();
      t1.set(0, 1, 0);
      if (Math.abs(nrm.y) > 0.9) t1.set(1, 0, 0);
      t1.cross(nrm).normalize();
      t2.copy(nrm).cross(t1).normalize();
      const roll = r() * Math.PI * 2, cr = Math.cos(roll), sr = Math.sin(roll);
      const ax = t1.clone().multiplyScalar(cr).addScaledVector(t2, sr), ay = t1.clone().multiplyScalar(-sr).addScaledVector(t2, cr);
      const sz = cardSize * (0.75 + r() * 0.5);
      const b0 = pos.length / 3;
      const sn = p.clone().sub(centre).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
      const ao = 0.45 + 0.55 * Math.pow((p.y - minY) / Math.max(1e-3, maxY - minY), 0.8) * (0.6 + 0.4 * dirv.dot(p.clone().sub(c).normalize()));
      const tint = 0.9 + r() * 0.2;
      for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        tmp.copy(p).addScaledVector(ax, a * sz).addScaledVector(ay, b * sz);
        pos.push(tmp.x, tmp.y, tmp.z);
        nor.push(sn.x, sn.y, sn.z);
        uv.push(a + 0.5, b + 0.5);
        col.push(ao * tint, ao * tint, ao * tint * 0.95);
      }
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
  }
  return mk(pos, nor, uv, col, idx);
}

/** A leafy shrub: one to three overlapping clusters of cards, sitting on the ground. */
export function bush(r, { rad = 0.7, h = 0.85, cardSize = 0.62 } = {}) {
  const cl = [];
  const n = 1 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const rr = rad * (0.6 + r() * 0.35);
    cl.push({ c: new THREE.Vector3((r() - 0.5) * rad * 1.2, Math.max(rr * 0.75, h - rr) * (0.85 + r() * 0.2), (r() - 0.5) * rad * 0.8), rad: rr });
  }
  return leafCards(r, cl, cardSize, 1.25, new THREE.Vector3(0, h * 0.25, 0));
}

/**
 * A broadleaf tree: bark trunk with a few limbs, and a canopy of leaf cards on several clusters.
 * Leaf cards carry the canopy-centre normal (soft, volumetric shading) and an AO tint.
 */
export function broadleaf(r, { h = 5, spread = 2.4, clusters = 5, cardSize = 1.5, density = 1 } = {}) {
  const trunk = new Batch();
  const leaves = [];
  const lean = new THREE.Vector3((r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4).normalize();
  const trunkTop = lean.clone().multiplyScalar(h * 0.62);
  // trunk
  const tg = new THREE.CylinderGeometry(0.16 + h * 0.02, 0.24 + h * 0.035, h * 0.66, 8, 3);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) / (h * 0.66) + 0.5;
    tp.setX(i, tp.getX(i) + lean.x * y * h * 0.62);
    tp.setZ(i, tp.getZ(i) + lean.z * y * h * 0.62);
    tp.setY(i, tp.getY(i) + h * 0.33);
    if (y < 0.12) { tp.setX(i, tp.getX(i) * (1.5 - y * 4)); tp.setZ(i, tp.getZ(i) * (1.5 - y * 4)); }
  }
  tg.computeVertexNormals();
  scaleUV(tg, 1.4, h * 0.66, false);
  trunk.add('bark', paint(tg, WHITE));
  // canopy clusters around the crown
  const crown = trunkTop.clone().add(new THREE.Vector3(0, h * 0.2, 0));
  const cl = [];
  for (let k = 0; k < clusters; k++) {
    const a = (k / clusters) * Math.PI * 2 + r() * 0.8;
    const dist = k === 0 ? 0 : spread * (0.45 + r() * 0.45);
    const c = crown.clone().add(new THREE.Vector3(Math.cos(a) * dist, (r() - 0.35) * spread * 0.55 + (k === 0 ? spread * 0.25 : 0), Math.sin(a) * dist));
    const rad = spread * (0.55 + r() * 0.3) * (k === 0 ? 1.15 : 1);
    cl.push({ c, rad });
    if (k > 0) {
      // a limb from the trunk to the cluster
      const from = trunkTop.clone().multiplyScalar(0.75 + r() * 0.2);
      const dir = c.clone().sub(from);
      const len = dir.length() * 0.8;
      const lg = new THREE.CylinderGeometry(0.05, 0.11, len, 5, 1, true);
      lg.translate(0, len / 2, 0);
      scaleUV(lg, 0.5, len);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
      trunk.add('bark', paint(lg, WHITE), new THREE.Matrix4().compose(from, q, new THREE.Vector3(1, 1, 1)));
    }
  }
  const centre = crown.clone().add(new THREE.Vector3(0, spread * 0.15, 0));
  leaves.push(leafCards(r, cl, cardSize, density, centre));
  // opaque stand-ins for the canopy in the shadow map (alpha-tested cards are slow to draw there)
  const proxy = [];
  for (const { c, rad } of cl) {
    const g = new THREE.IcosahedronGeometry(rad * 0.85, 0);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g.translate(c.x, c.y, c.z);
    proxy.push(g);
  }
  return { trunk, leaves: leaves[0], proxy: mergeGeometries(proxy), top: Math.max(...cl.map(({ c, rad }) => c.y + rad)) };
}
