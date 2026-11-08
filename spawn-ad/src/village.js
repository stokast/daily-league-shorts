// Geometry kit for the village (used by src/world.js): metre-scaled uvs, parts batched by material key and
// merged; half-timbered houses, the town gate, the bridge, market stalls, the well, the chapel tower, the
// castle, props and leaf-card trees. Materials (real PBR texture sets) are assigned per key in world.js; vertex
// colours tint them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = (hex) => new THREE.Color(hex);
const WHITE = new THREE.Color(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Texture tile size in metres per batch key (uvs are built in metres); world.js fills it from the asset sets. */
export const TILE = {};

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
    for (const [k, list] of Object.entries(other.parts)) for (const g of list) this.add(k, m ? g.clone() : g, m);
  }
  build(key) {
    const parts = this.parts[key];
    if (!parts?.length) return null;
    const g = mergeGeometries(parts.map(clean));
    const k = 1 / (TILE[key] || 1);
    if (k !== 1) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    }
    g.computeBoundingSphere();
    return g;
  }
}
/** Only position, normal, uv and color, indexed (so everything merges). */
function clean(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.index) {
    const n = g.attributes.position.count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
  }
  if (!g.attributes.color) paint(g, WHITE);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
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
export function scaleUV(g, su, sv, swap = false) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i) * su, v = uv.getY(i) * sv;
    if (swap) uv.setXY(i, v, u); else uv.setXY(i, u, v);
  }
  return g;
}
/** Matrix from position + Euler (x, y, z order) + uniform scale. */
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
  return paint(weld(g), color);
}
/** Weld a non-indexed geometry (icosphere) so normals are smooth and it merges with indexed parts. */
function weld(g) {
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

/** Extrude a 2D shape (x, y in metres) by depth along +z, centred on z = 0; uvs in metres on every face. */
export function extrude(shape, depth, color = WHITE, curveSegments = 16) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  // metre uvs: front/back faces use x, y; side walls use (length along the outline, z)
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nz = Math.abs(n.getZ(i));
    if (nz > 0.5) uv.setXY(i, p.getX(i), p.getY(i));
    else if (Math.abs(n.getY(i)) > Math.abs(n.getX(i))) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getZ(i), p.getY(i));
  }
  const out = g.index ? g : (() => { const q = g; q.setIndex(Array.from({ length: q.attributes.position.count }, (_, i) => i)); return q; })();
  return paint(out, color);
}

// --------------------------------------------------------------------------------- the cottage
// Colours are multipliers on the textures (vertex colours).
export const PALETTE = {
  walls: ['#fff4e2', '#ffe9c9', '#ffe1cf', '#f6f0e4', '#ffe6b0', '#f4e2c6', '#fff8ee'].map(C),
  clay: ['#ffffff', '#ffd0c0', '#ffe2b0', '#f8b8a0'].map(C),
  slate: [[1.05, 1.3, 1.75], [0.95, 1.25, 1.65], [0.95, 1.45, 1.45], [1.2, 1.15, 1.6], [0.9, 1.2, 1.7]].map(([r, g, b]) => new THREE.Color(r, g, b)),
  thatch: ['#f2d79a', '#e6c88c'].map(C),
  shutters: ['#2f6f8f', '#3f7a4a', '#9a3f34', '#1d7f88', '#6a4a7a', '#c08a2a'].map(C),
  timber: C('#7a5a44'),
  doors: ['#7a4a2a', '#5a3a28', '#8a3a2a', '#2f5a6a', '#4a6a3a'].map(C),
  flowers: ['#e8455a', '#f2a2c0', '#ffffff', '#f6c042', '#c46ad8', '#ff7a3a', '#ff5a8a'].map(C),
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
 * A half-timbered house. Local space: ground at y = 0, front (door) facing +z, width w along x.
 * o: { w, d, floors (1-3), ridgeAlongX, pitch, wall, roofKey ('clay' | 'slate' | 'thatch'), roof (tint), shutter,
 *      groundStone, hidden (Set of wall sides never seen), sign (atlas cell), awning (cloth row), porch, litChance }
 * Returns the parts in a Batch plus anchors (chimney top, lamps, door, windows) in local space.
 */
export function cottage(r, o) {
  const B = new Batch();
  const { w, d, floors, groundStone, ridgeAlongX, pitch, wall: wallC, roof: roofC, shutter } = o;
  const roofKey = o.roofKey || 'clay';
  const P = 0.55; // plinth top
  const hs = [o.h1 ?? 2.85, o.h2 ?? 2.5, o.h3 ?? 2.35].slice(0, floors);
  const jet = o.jetty ?? 0.35;
  const anchors = { lamps: [], smoke: null, glow: [], windows: [] };
  const hidden = o.hidden || new Set();
  const tim = PALETTE.timber.clone().multiplyScalar(0.85 + r() * 0.3);
  const plasterC = wallC.clone();
  const stoneC = new THREE.Color(1, 0.97, 0.92).multiplyScalar(0.85 + r() * 0.2);

  // plinth, sunk into the ground so slopes never show a gap
  const D0 = d;
  B.add('stone', box(w + 0.24, P + 0.6, d + 0.24, stoneC, { bottom: 0.7, faces: 31 }), M(0, (P - 0.6) / 2, 0));
  // storeys: each upper one jettied out front and back
  const storeys = [];
  let y = P, D = d;
  hs.forEach((h, k) => {
    if (k > 0) D += 2 * jet;
    storeys.push({ y0: y, y1: y + h, W: w, D, ground: k === 0 });
    y += h;
  });
  const top = y;
  storeys.forEach((st, k) => {
    const h = st.y1 - st.y0;
    if (k === 0 && groundStone) B.add('stone', box(w, h, st.D, stoneC, { bottom: 0.8, faces: 15 }), M(0, st.y0 + h / 2, 0));
    else B.add('plaster', box(w - 0.02, h, st.D - 0.02, plasterC, { bottom: k === 0 ? 0.82 : 1, faces: k === 0 ? 15 : 47 }), M(0, st.y0 + h / 2, 0));
    if (k > 0) {
      // joist ends under the jetty, and the bressumer beams
      for (const sz of hidden.has('back') ? [1] : [-1, 1]) {
        for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.55) {
          B.add('timber', box(0.14, 0.15, jet + 0.12, tim, { grain: true, uo: x, faces: 47 }), M(x, st.y0 - 0.075, sz * (storeys[k - 1].D / 2 + jet / 2 - 0.02)));
        }
        B.add('timber', box(w + 0.06, 0.22, 0.17, tim, { grain: true }), M(0, st.y0 + 0.06, sz * (st.D / 2 - 0.04)));
      }
    }
  });

  // ---- timber framing, doors and windows on each wall of each storey
  let doorDone = false;
  for (const st of storeys) {
    for (const wl of walls(st.W, st.D)) {
      if (hidden.has(wl.side)) continue; // never faces the camera
      const stoneHere = st.ground && groundStone;
      const L = wl.len;
      const hgt = st.y1 - st.y0;
      const nb = Math.max(2, Math.round(L / 1.55));
      const bw = L / nb;
      const plan = Array.from({ length: nb }, () => 'plain');
      const isFront = wl.side === 'front';
      const isEnd = wl.side === 'left' || wl.side === 'right';
      let doorBay = -1;
      if (st.ground && isFront && !doorDone) {
        doorBay = o.doorBay ?? Math.min(nb - 1, Math.max(0, Math.floor(nb / 2) + (r() < 0.5 ? -1 : 0)));
        plan[doorBay] = 'door';
        doorDone = true;
      }
      for (let k = 0; k < nb; k++) {
        if (plan[k] !== 'plain') continue;
        const winP = wl.side === 'back' ? 0.3 : isEnd ? 0.55 : 0.7;
        if (Math.abs(k - doorBay) === 1 && r() < 0.4) continue;
        if (r() < winP) plan[k] = 'window';
        else if (!st.ground || r() < 0.6) plan[k] = r() < 0.5 ? 'brace' : 'cross';
      }
      if (!stoneHere) {
        for (let k = 0; k <= nb; k++) {
          const s = Math.min(L - 0.1, Math.max(0.1, k * bw));
          const corner = k === 0 || k === nb;
          B.add('timber', box(corner ? 0.26 : 0.19, hgt, 0.12, tim, { grain: true, uo: k * 0.37, faces: 7 }), wallM(wl, s, st.y0 + hgt / 2, 0.02));
        }
        B.add('timber', box(L + 0.04, 0.22, 0.14, tim, { grain: true, faces: 53 }), wallM(wl, L / 2, st.y0 + 0.11, 0.022));
        B.add('timber', box(L + 0.04, 0.22, 0.14, tim, { grain: true, uo: 0.5, faces: 53 }), wallM(wl, L / 2, st.y1 - 0.11, 0.022));
      }
      for (let k = 0; k < nb; k++) {
        const s0 = k * bw, s1 = (k + 1) * bw, sc = (s0 + s1) / 2;
        const inner = bw - 0.19;
        const kind = plan[k];
        if (kind === 'door') {
          const dw = Math.min(1.1, bw - 0.3), dh = 2.1;
          const dy = st.y0;
          B.add('planks', box(dw, dh, 0.07, o.doorColor, { grain: true }), wallM(wl, sc, dy + dh / 2, 0.0));
          B.add('timber', box(0.15, dh + 0.12, 0.16, tim, { grain: true }), wallM(wl, sc - dw / 2 - 0.07, dy + dh / 2, 0.04));
          B.add('timber', box(0.15, dh + 0.12, 0.16, tim, { grain: true }), wallM(wl, sc + dw / 2 + 0.07, dy + dh / 2, 0.04));
          B.add('timber', box(dw + 0.44, 0.2, 0.18, tim, { grain: true }), wallM(wl, sc, dy + dh + 0.1, 0.045));
          for (const yy of [0.35, 1.7]) B.add('iron', box(dw * 0.82, 0.05, 0.02, C('#26221f')), wallM(wl, sc - dw * 0.08, dy + yy, 0.045));
          B.add('iron', cyl(0.035, 0.035, 0.02, 10, C('#2a2622')), wallM(wl, sc + dw * 0.32, dy + 1.0, 0.05).multiply(M(0, 0, 0, Math.PI / 2)));
          // stone steps down to the ground
          B.add('stone', box(dw + 0.55, 0.28, 0.45, stoneC), wallM(wl, sc, 0.14, 0.32));
          B.add('stone', box(dw + 0.4, 0.27, 0.28, stoneC), wallM(wl, sc, 0.415, 0.14));
          // a lantern by the door (the lantern model is put on the anchor)
          const side = r() < 0.5 ? -1 : 1;
          const ls = sc + (dw / 2 + 0.42) * side;
          B.add('iron', box(0.05, 0.05, 0.34, C('#26221f')), wallM(wl, ls, dy + 2.18, 0.17));
          anchors.lamps.push({ pos: new THREE.Vector3(0, dy + 1.92, 0).applyMatrix4(wallM(wl, ls, 0, 0.34)), hang: true, n: wl.n.clone() });
          anchors.door = { wl, s: sc, w: dw, y: dy, pos: new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, sc, 0, 0.55)), lamp: ls, side };
          if (o.porch) {
            // a little pent roof over the door on two brackets
            const pw = dw + 1.2, pd = 0.9, py = dy + 2.55;
            const p0 = [-pw / 2, py + 0.35, 0], p1 = [pw / 2, py + 0.35, 0], p2 = [pw / 2, py, pd], p3 = [-pw / 2, py, pd];
            const sl = Math.hypot(pd, 0.35);
            B.add(roofKey, quad([p3, p2, p1, p0], [[0, 0], [pw, 0], [pw, sl], [0, sl]], roofC), wallM(wl, sc, 0, 0));
            B.add('planks', quad([p0, p1, p2, p3], [[0, 0], [pw, 0], [pw, sl], [0, sl]], C('#8a705a')), wallM(wl, sc, 0, 0));
            for (const sx of [-1, 1]) B.add('timber', box(0.09, 0.09, 0.95, tim, { grain: true }), wallM(wl, sc + sx * (pw / 2 - 0.15), py - 0.28, 0.38).multiply(M(0.6, 0, 0)));
          }
          continue;
        }
        if (kind === 'window') {
          const ww = Math.min(st.ground ? 0.95 : 0.88, inner - 0.14);
          const wh = st.ground ? 1.2 : 1.05;
          const wy = st.ground ? st.y0 + 0.95 + wh / 2 : st.y0 + 0.72 + wh / 2;
          const lit = r() < (o.litChance ?? 0.5);
          const gc = lit ? C('#ffb45c').multiplyScalar(1.5 + r() * 0.3) : C('#4d5a72').multiplyScalar(0.5);
          B.add(lit ? 'glass' : 'darkglass', quad([[-ww / 2, -wh / 2, 0], [ww / 2, -wh / 2, 0], [ww / 2, wh / 2, 0], [-ww / 2, wh / 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], gc), wallM(wl, sc, wy, 0.006));
          if (lit) anchors.glow.push(new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, sc, wy, 0.1)));
          anchors.windows.push({ pos: new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, sc, wy, 0.1)), lit, side: wl.side });
          B.add('timber', box(ww + 0.18, 0.1, 0.1, tim, { grain: true, faces: 55 }), wallM(wl, sc, wy + wh / 2 + 0.05, 0.035));
          B.add('timber', box(0.09, wh, 0.09, tim, { grain: true, faces: 7 }), wallM(wl, sc - ww / 2 - 0.045, wy, 0.035));
          B.add('timber', box(0.09, wh, 0.09, tim, { grain: true, faces: 7 }), wallM(wl, sc + ww / 2 + 0.045, wy, 0.035));
          B.add('timber', box(ww + 0.28, 0.08, 0.18, tim, { grain: true, faces: 55 }), wallM(wl, sc, wy - wh / 2 - 0.04, 0.08));
          // mullion and transom
          B.add('timber', box(0.05, wh, 0.05, tim, { grain: true, faces: 7 }), wallM(wl, sc, wy, 0.03));
          B.add('timber', box(ww, 0.05, 0.05, tim, { grain: true, faces: 7 }), wallM(wl, sc, wy + wh * 0.18, 0.03));
          if (!stoneHere) {
            B.add('timber', box(inner, 0.14, 0.13, tim, { grain: true, faces: 52 }), wallM(wl, sc, wy - wh / 2 - 0.13, 0.022));
            B.add('timber', box(inner, 0.14, 0.13, tim, { grain: true, faces: 52 }), wallM(wl, sc, wy + wh / 2 + 0.13, 0.022));
          }
          if (shutter && r() < 0.6 && plan[k - 1] !== 'window' && plan[k + 1] !== 'window') {
            for (const sx of [-1, 1]) B.add('planks', box(ww * 0.45, wh + 0.04, 0.05, shutter, { grain: true, uo: sx }), wallM(wl, sc + sx * (ww * 0.72 + 0.1), wy, 0.1));
          }
          if (r() < (st.ground ? 0.5 : 0.4) && wl.side !== 'back') flowerBox(B, r, ww, (s, yy, n) => wallM(wl, sc + s, wy - wh / 2 + yy, n));
          continue;
        }
        if (stoneHere) continue;
        if (kind === 'brace' || kind === 'cross') {
          const hh = hgt - 0.44, ww = inner;
          const len = Math.hypot(ww, hh), ang = Math.atan2(hh, ww);
          const dirs = kind === 'cross' ? [1, -1] : [(k % 2 ? 1 : -1)];
          for (const sgn of dirs) B.add('timber', box(len, 0.16, 0.1, tim, { grain: true, uo: k, faces: 55 }), wallM(wl, sc, st.y0 + 0.22 + hh / 2, 0.008).multiply(M(0, 0, 0, 0, 0, sgn * ang)));
        } else {
          B.add('timber', box(inner, 0.15, 0.13, tim, { grain: true, uo: k * 0.3, faces: 52 }), wallM(wl, sc, st.y0 + hgt * 0.52, 0.022));
        }
      }
    }
  }

  // ---- roof (built with the ridge along x, then turned if the ridge runs front to back)
  const D2 = storeys[storeys.length - 1].D;
  const RW = ridgeAlongX ? w : D2, RD = ridgeAlongX ? D2 : w;
  const rot = ridgeAlongX ? new THREE.Matrix4() : M(0, 0, 0, 0, Math.PI / 2, 0);
  const R = new Batch();
  const tan = Math.tan(pitch);
  const rh = (RD / 2) * tan;
  const over = roofKey === 'thatch' ? 0.65 : 0.55, gx = roofKey === 'thatch' ? 0.5 : 0.42, th = roofKey === 'thatch' ? 0.34 : 0.16;
  const ridgeY = top + rh;
  const slopeLen = Math.hypot(RD / 2 + over, (RD / 2 + over) * tan);
  const roofTint = roofC.clone();
  for (const sz of [-1, 1]) {
    const ez = sz * (RD / 2 + over), ey = top - over * tan;
    const nrm = new THREE.Vector3(0, Math.cos(pitch), sz * Math.sin(pitch));
    const lift = nrm.clone().multiplyScalar(th);
    const p0 = [-RW / 2 - gx, ridgeY, 0], p1 = [RW / 2 + gx, ridgeY, 0], p2 = [RW / 2 + gx, ey, ez], p3 = [-RW / 2 - gx, ey, ez];
    const L = (p) => [p[0] + lift.x, p[1] + lift.y, p[2] + lift.z];
    // v runs up the slope (eave 0 -> ridge), so the tiles' overlap reads the right way
    const uvs = [[0, slopeLen], [RW + 2 * gx, slopeLen], [RW + 2 * gx, 0], [0, 0]];
    const topQ = sz > 0 ? [L(p0), L(p3), L(p2), L(p1)] : [L(p1), L(p2), L(p3), L(p0)];
    const topUV = sz > 0 ? [uvs[0], uvs[3], uvs[2], uvs[1]] : [uvs[1], uvs[2], uvs[3], uvs[0]];
    R.add(roofKey, quad(topQ, topUV, roofTint.clone().multiplyScalar(0.94 + r() * 0.1)));
    const botQ = sz > 0 ? [p0, p1, p2, p3] : [p1, p0, p3, p2];
    R.add('planks', quad(botQ, [[0, 0], [RW, 0], [RW, slopeLen], [0, slopeLen]], C('#7a6450')));
    // the edge along the eave (thatch: a thick rounded-looking lip in the roof material)
    R.add(roofKey === 'thatch' ? 'thatch' : 'timber', quad(sz > 0 ? [p3, p2, L(p2), L(p3)] : [p2, p3, L(p3), L(p2)], [[0, 0], [RW, 0], [RW, th], [0, th]], roofKey === 'thatch' ? roofTint.clone().multiplyScalar(0.8) : tim));
    for (const sx of [-1, 1]) {
      const x = sx * (RW / 2 + gx);
      if (roofKey === 'thatch') {
        // gable edge of the thatch
        const a = [x, ridgeY + th, 0], b = [x, ey + th, ez], c = [x, ey, ez], dd = [x, ridgeY, 0];
        const q = (sx > 0) === (sz > 0) ? [a, b, c, dd] : [b, a, dd, c];
        R.add('thatch', quad(q, [[0, 0], [slopeLen, 0], [slopeLen, th], [0, th]], roofTint.clone().multiplyScalar(0.75)));
      } else {
        const a = [x, ridgeY + th + 0.05, 0], b = [x, ey + th * 0.4, ez + sz * 0.04], c = [x, ey - 0.17, ez + sz * 0.04], dd = [x, ridgeY - 0.22, 0];
        const q = (sx > 0) === (sz > 0) ? [a, b, c, dd] : [b, a, dd, c];
        R.add('timber', quad(q, [[0, 0], [slopeLen, 0], [slopeLen, 0.3], [0, 0.3]], tim));
      }
    }
  }
  // ridge
  if (roofKey === 'thatch') R.add('thatch', cyl(0.3, 0.3, RW + 2 * gx, 10, roofTint.clone().multiplyScalar(0.85), { swap: true }), M(0, ridgeY + th * 0.55, 0, 0, 0, Math.PI / 2));
  else R.add(roofKey, box(RW + 2 * gx + 0.08, 0.16, 0.34, roofTint.clone().multiplyScalar(0.75), { faces: 63 }), M(0, ridgeY + th + 0.04, 0));
  // gable triangles, plaster with a king post and struts
  for (const sx of [-1, 1]) {
    const x = sx * RW / 2;
    const gside = ridgeAlongX ? (sx > 0 ? 'right' : 'left') : (sx > 0 ? 'back' : 'front');
    const a = [x, top, -RD / 2], b = [x, top, RD / 2], c = [x, ridgeY, 0];
    const q = sx > 0 ? [b, a, c] : [a, b, c];
    const uq = sx > 0 ? [[RD, 0], [0, 0], [RD / 2, rh]] : [[0, 0], [RD, 0], [RD / 2, rh]];
    R.add('plaster', tri(q, uq, plasterC));
    if (hidden.has(gside)) continue;
    const gm = (yy, z, rz) => M(x + sx * 0.03, yy, z, 0, Math.PI / 2, rz);
    R.add('timber', box(0.18, rh - 0.1, 0.11, tim, { grain: true }), gm(top + (rh - 0.1) / 2, 0, 0));
    R.add('timber', box(RD - 0.1, 0.18, 0.11, tim, { grain: true }), gm(top + 0.09, 0, 0));
    R.add('timber', box(RD * 0.55 * 0.95, 0.15, 0.11, tim, { grain: true }), gm(top + rh * 0.45, 0, 0));
    for (const sgn of [-1, 1]) {
      const len = Math.hypot(RD * 0.25, rh * 0.45), ang = Math.atan2(rh * 0.45, RD * 0.25);
      R.add('timber', box(len, 0.14, 0.1, tim, { grain: true }), gm(top + rh * 0.225, sgn * RD * 0.125 * sx, sgn * ang));
    }
    if (rh > 1.9 && r() < 0.75) {
      const gw = 0.6, gh = 0.78;
      const lit = r() < 0.5;
      const gc = lit ? C('#ffb45c').multiplyScalar(1.45) : C('#4d5a72').multiplyScalar(0.5);
      const wq = quad([[-gw / 2, -gh / 2, 0], [gw / 2, -gh / 2, 0], [gw / 2, gh / 2, 0], [-gw / 2, gh / 2, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], gc);
      R.add(lit ? 'glass' : 'darkglass', wq, M(x + sx * 0.02, top + rh * 0.62, 0, 0, sx * Math.PI / 2, 0));
      R.add('timber', box(gw + 0.16, 0.08, 0.14, tim, { grain: true }), M(x + sx * 0.05, top + rh * 0.62 - gh / 2 - 0.04, 0, 0, Math.PI / 2, 0));
    }
  }
  // chimney through the roof
  const chx = (r() < 0.5 ? -1 : 1) * (RW / 2 - 0.8), chz = (r() < 0.5 ? -1 : 1) * Math.min(RD * 0.18, 0.9);
  const chTop = ridgeY + 0.9 + r() * 0.6;
  R.add('brick', box(0.78, chTop - top + 0.4, 0.78, WHITE.clone().multiplyScalar(0.9 + r() * 0.15)), M(chx, (chTop + top - 0.4) / 2, chz));
  R.add('stone', box(0.94, 0.15, 0.94, stoneC.clone().multiplyScalar(0.9)), M(chx, chTop + 0.075, chz));
  R.add('clay', cyl(0.13, 0.16, 0.36, 10, C('#e0a080')), M(chx, chTop + 0.33, chz));
  anchors.smoke = new THREE.Vector3(chx, chTop + 0.52, chz).applyMatrix4(rot);
  B.take(R, rot);

  // ---- a hanging sign and an awning on shops
  if (o.sign != null && anchors.door) {
    const { wl, s } = anchors.door;
    const ss = s + (s > wl.len / 2 ? -1.2 : 1.2);
    const sy = P + 2.95;
    B.add('iron', box(0.06, 0.06, 1.15, C('#26221f')), wallM(wl, ss, sy + 0.4, 0.57));
    B.add('iron', box(0.035, 0.45, 0.035, C('#26221f')), wallM(wl, ss, sy + 0.18, 1.02).multiply(M(0, 0, 0, 0.5, 0, 0)));
    for (const dz of [0.28, 0.9]) B.add('iron', box(0.015, 0.16, 0.015, C('#3a3530')), wallM(wl, ss, sy + 0.3, dz));
    const sg = box(0.04, 0.5, 0.86, WHITE, { faces: 0b000011 });
    const cell = o.sign % 4, cu = (cell % 2) * 0.5, cv = Math.floor(cell / 2) * 0.5;
    const uv = sg.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i) / 0.86, v = uv.getY(i) / 0.5;
      uv.setXY(i, cu + u * 0.5, cv + (1 - v) * 0.5);
    }
    B.add('sign', sg, wallM(wl, ss, sy - 0.05, 0.6));
    B.add('planks', box(0.06, 0.54, 0.92, C('#6a4a34'), { faces: 0b111100, grain: true }), wallM(wl, ss, sy - 0.05, 0.6));
    anchors.sign = new THREE.Vector3(0, 0, 0).applyMatrix4(wallM(wl, ss, sy, 0.6));
  }
  if (o.awning != null && anchors.door) {
    const { wl, s, w: dw } = anchors.door;
    const aw = Math.min(wl.len - 0.4, dw + 2.2), depth = 1.1, y0 = P + 2.62;
    const q = quad([[-aw / 2, -0.6, depth], [aw / 2, -0.6, depth], [aw / 2, 0, 0], [-aw / 2, 0, 0]], [[0, 1], [aw / 2.4, 1], [aw / 2.4, 0], [0, 0]], WHITE);
    awningRow(q, o.awning);
    B.add('awning', q, wallM(wl, s, y0, 0.02));
    for (const sx of [-1, 1]) B.add('iron', box(0.03, 0.03, 1.25, C('#26221f')), wallM(wl, s + sx * aw / 2 * 0.95, y0 - 0.3, 0.55).multiply(M(Math.atan2(0.6, depth), 0, 0)));
  }
  return { B, anchors, height: ridgeY + th, top, ridgeY, depth: D0 };
}

/** A flower box under a window: planks box, a mound of leaves and blossoms. place(s, y, n) -> matrix. */
function flowerBox(B, r, ww, place) {
  B.add('planks', box(ww + 0.22, 0.22, 0.24, C('#9a7a5a'), { grain: true }), place(0, -0.2, 0.16));
  const fc = PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)];
  const fc2 = PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)];
  for (let f = 0; f < 11; f++) {
    const leaf = f % 3 === 0;
    const c = leaf ? C('#3f7a2a').multiplyScalar(0.8 + r() * 0.3) : (f % 2 ? fc : fc2).clone().multiplyScalar(0.85 + r() * 0.3);
    B.add('plain', blob(leaf ? 0.09 : 0.07, c, 0), place(-ww / 2 + (f + 0.5) * (ww / 11), -0.07 + r() * 0.07, 0.17 + (r() - 0.5) * 0.12));
  }
}

/** Point a quad's uvs at one row of the awning cloth atlas (4 colourways stacked; u repeats; v = 1 at the hem). */
export function awningRow(g, row) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (row % 4) * 0.25 + uv.getY(i) * 0.245 + 0.002);
  return g;
}

// --------------------------------------------------------------------------- the town gate
/**
 * A stone gatehouse over the road. Local: road along z (travel towards -z), gate centred on x = 0, front face at
 * +z. The arch clears 5.9 m over the road's 5 m. Returns the batch and anchors (lamps, banners).
 */
export function gate(r) {
  const B = new Batch();
  const stoneC = new THREE.Color(1, 0.98, 0.95);
  const trimC = new THREE.Color(1, 0.96, 0.9);
  const HW = 5.3, H = 8.0, DEP = 3.2, AR = 3.15, SPR = 4.1; // half width, height, depth, arch radius, springing
  // the gatehouse's face: an outline with the arch cut up into it from the ground
  const outline = new THREE.Shape();
  outline.moveTo(-HW, 0); outline.lineTo(-AR, 0); outline.lineTo(-AR, SPR);
  outline.absarc(0, SPR, AR, Math.PI, 0, true);
  outline.lineTo(AR, 0); outline.lineTo(HW, 0); outline.lineTo(HW, H); outline.lineTo(-HW, H); outline.lineTo(-HW, 0);
  B.add('stone', extrude(outline, DEP, stoneC, 20));
  // voussoir ring and impost bands in dressed stone, proud of both faces
  const ring = new THREE.Shape();
  ring.absarc(0, SPR, AR + 0.55, 0, Math.PI, false); ring.lineTo(-AR, SPR); ring.absarc(0, SPR, AR, Math.PI, 0, true); ring.lineTo(AR + 0.55, SPR);
  for (const sz of [-1, 1]) {
    B.add('ashlar', extrude(ring, 0.25, trimC, 20), M(0, 0, sz * (DEP / 2 + 0.1)));
    for (const sx of [-1, 1]) B.add('ashlar', box(0.75, 0.32, 0.3, trimC), M(sx * (AR + 0.2), SPR - 0.1, sz * (DEP / 2 + 0.08)));
    // string course under the battlements
    B.add('ashlar', box(2 * HW + 0.3, 0.28, 0.3, trimC), M(0, H - 0.1, sz * (DEP / 2 + 0.05)));
  }
  // crenellations
  const mw = 0.7, gap = 0.55;
  for (const sz of [-1, 1]) {
    for (let x = -HW + mw / 2; x <= HW - mw / 2 + 1e-6; x += mw + gap) B.add('stone', box(mw, 0.85, 0.5, stoneC), M(x, H + 0.42, sz * (DEP / 2 - 0.25)));
  }
  B.add('stone', box(2 * HW, 0.25, DEP, stoneC, { faces: 16 }), M(0, H + 0.0, 0));
  // flanking round towers with slate caps
  for (const sx of [-1, 1]) {
    const tx = sx * (HW + 1.6), tr = 2.1, tH = 10.8;
    B.add('stone', cyl(tr, tr + 0.15, tH, 20, stoneC), M(tx, tH / 2, -0.2));
    B.add('ashlar', cyl(tr + 0.28, tr + 0.28, 0.35, 20, trimC), M(tx, tH - 0.6, -0.2));
    B.add('slate', cyl(0.05, tr + 0.5, 4.8, 20, C('#7fa8d8')), M(tx, tH + 2.35, -0.2));
    B.add('iron', cyl(0.03, 0.05, 1.2, 6, C('#2a2622')), M(tx, tH + 5.2, -0.2));
    // arrow slits facing the road
    for (const yy of [3.2, 6.6]) {
      const a = sx > 0 ? Math.PI + 0.5 : -0.5;
      const nx = Math.sin(a), nz = Math.cos(a);
      B.add('darkglass', quad([[-0.09, -0.45, 0], [0.09, -0.45, 0], [0.09, 0.45, 0], [-0.09, 0.45, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], C('#1a1c22')),
        M(tx + nx * (tr + 0.02), yy, -0.2 + nz * (tr + 0.02), 0, a, 0));
    }
  }
  // town wall running off both ways
  for (const sx of [-1, 1]) {
    const x0 = sx * (HW + 3.6), x1 = sx * 34, len = Math.abs(x1 - x0);
    B.add('stone', box(len, 5.6, 1.6, stoneC, { bottom: 0.8 }), M((x0 + x1) / 2, 2.6, -0.6));
    for (let k = 0; k < len / 1.25 - 0.5; k++) B.add('stone', box(0.65, 0.7, 0.45, stoneC), M(x0 + sx * (0.5 + k * 1.25), 5.75, 0.0));
  }
  const anchors = {
    lamps: [-1, 1].map((sx) => ({ pos: new THREE.Vector3(sx * (AR + 0.85), 3.2, DEP / 2 + 0.42), hang: false, n: new THREE.Vector3(0, 0, 1) })),
    banners: [-1, 1].map((sx) => ({ x: sx * (AR + 1.35), y: H - 0.45, z: DEP / 2 + 0.09 })),
  };
  return { B, anchors, halfWidth: HW, depth: DEP };
}

// ------------------------------------------------------------------------------ the bridge
/** Parapets of the bridge over the stream. Local: road along z, centred; span along z. */
export function bridgeParapets(len) {
  const B = new Batch();
  const stoneC = new THREE.Color(1, 0.97, 0.94);
  for (const sx of [-1, 1]) {
    const x = sx * 2.95;
    B.add('stone', box(0.5, 1.0, len, stoneC, { bottom: 0.75 }), M(x, 0.42, 0));
    B.add('ashlar', box(0.62, 0.14, len + 0.1, stoneC), M(x, 0.98, 0));
    // the outer face down to the water, with the arch's voussoirs
    B.add('stone', box(0.5, 2.6, len - 1.2, stoneC.clone().multiplyScalar(0.9)), M(x + sx * 0.02, -1.3, 0));
    for (const sz of [-1, 1]) B.add('stone', box(0.9, 1.25, 0.9, stoneC), M(x + sx * 0.2, 0.55, sz * (len / 2 - 0.2)));
    for (const sz of [-1, 1]) B.add('ashlar', cyl(0.0, 0.36, 0.45, 4, stoneC), M(x + sx * 0.2, 1.4, sz * (len / 2 - 0.2), 0, Math.PI / 4, 0));
  }
  return B;
}

// --------------------------------------------------------------------------------- props
/** A wooden post with an arm; the lantern model hangs from the returned anchor. */
export function lampPost(B, m) {
  const wood = PALETTE.timber.clone().multiplyScalar(0.8);
  B.add('stone', box(0.4, 0.42, 0.4, WHITE.clone().multiplyScalar(0.85), { bottom: 0.6 }), m.clone().multiply(M(0, 0.12, 0)));
  B.add('timber', box(0.16, 3.25, 0.16, wood, { grain: true }), m.clone().multiply(M(0, 1.9, 0)));
  B.add('timber', box(0.85, 0.12, 0.12, wood, { grain: true }), m.clone().multiply(M(0.36, 3.42, 0)));
  B.add('timber', box(0.1, 0.55, 0.1, wood, { grain: true }), m.clone().multiply(M(0.18, 3.18, 0, 0, 0, -0.75)));
  B.add('iron', box(0.03, 0.18, 0.03, C('#26221f')), m.clone().multiply(M(0.68, 3.28, 0)));
  return new THREE.Vector3(0.68, 2.92, 0).applyMatrix4(m);
}

export function fence(B, m, len, r) {
  const wood = WHITE.clone().multiplyScalar(0.8 + r() * 0.2);
  const n = Math.max(1, Math.round(len / 1.5));
  for (let k = 0; k <= n; k++) {
    const x = -len / 2 + (k / n) * len;
    B.add('planks', box(0.11, 1.05, 0.11, wood, { grain: true, uo: k }), m.clone().multiply(M(x, 0.44, 0, 0, 0, (r() - 0.5) * 0.06)));
  }
  for (const y of [0.42, 0.82]) B.add('planks', box(len + 0.1, 0.1, 0.05, wood, { grain: true, uo: y }), m.clone().multiply(M(0, y, 0.07, 0, 0, (r() - 0.5) * 0.02)));
}

/** A low-poly barrel in the plank texture with iron hoops (the glTF barrel is kept for a few close ones). */
export function barrel(B, m, r) {
  const prof = (t) => 0.285 + 0.055 * Math.sin(t * Math.PI);
  const pts = [];
  for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector2(prof(k / 6), (k / 6) * 0.88));
  const g = new THREE.LatheGeometry(pts, 14);
  scaleUV(g, Math.PI * 0.64, 0.88, true);
  const tint = C('#c8a888').multiplyScalar(0.8 + r() * 0.3);
  B.add('planks', paint(g, tint), m.clone());
  B.add('planks', cyl(0.28, 0.28, 0.02, 14, tint.clone().multiplyScalar(0.8)), m.clone().multiply(M(0, 0.865, 0)));
  for (const y of [0.1, 0.27, 0.61, 0.78]) {
    const rr = prof(y / 0.88) + 0.008;
    B.add('iron', cyl(rr, rr, 0.045, 14, C('#2c2a28'), { open: true }), m.clone().multiply(M(0, y, 0)));
  }
}

/** A plank crate with corner posts. */
export function crate(B, m, r, s = 0.6) {
  const c = C('#d8c0a0').multiplyScalar(0.8 + r() * 0.25);
  B.add('planks', box(s, s, s, c, { grain: true, uo: r() }), m.clone().multiply(M(0, s / 2, 0)));
  const e = 0.06, t = PALETTE.timber;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.add('timber', box(e, s + 0.01, e, t, { grain: true }), m.clone().multiply(M(x * (s / 2 - e / 2 + 0.01), s / 2, z * (s / 2 - e / 2 + 0.01))));
  for (const y of [e / 2, s - e / 2]) for (const [x, z, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    B.add('timber', box(s, e, e, t, { grain: true }), m.clone().multiply(M(x * (s / 2 - e / 2 + 0.012), y, z * (s / 2 - e / 2 + 0.012), 0, ry, 0)));
  }
}

/** A small iron lantern with warm glass; local origin at its hook (it hangs below). */
export function lantern(B, m) {
  const iron = C('#2a2622');
  B.add('iron', box(0.03, 0.08, 0.03, iron), m.clone().multiply(M(0, -0.04, 0)));
  B.add('iron', cyl(0.02, 0.17, 0.12, 4, iron), m.clone().multiply(M(0, -0.14, 0, 0, Math.PI / 4, 0)));
  B.add('iron', box(0.24, 0.03, 0.24, iron), m.clone().multiply(M(0, -0.215, 0)));
  B.add('glow', box(0.17, 0.25, 0.17, C('#ffc27a').multiplyScalar(1.9)), m.clone().multiply(M(0, -0.36, 0)));
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.add('iron', box(0.025, 0.27, 0.025, iron, { faces: 15 }), m.clone().multiply(M(dx * 0.095, -0.36, dz * 0.095)));
  B.add('iron', box(0.22, 0.04, 0.22, iron), m.clone().multiply(M(0, -0.5, 0)));
  return new THREE.Vector3(0, -0.36, 0).applyMatrix4(m);
}

/** Bunting: a sagging rope between two points with little flags (both faces) in festival colours. */
export function bunting(B, a, b, sag) {
  const n = Math.max(2, Math.round(a.distanceTo(b) / 0.42));
  const cols = ['#1d96a0', '#ffd9a0', '#d2483a', '#f0b84a', '#f4f1ea', '#3c6cb0'].map(C);
  const pt = (t) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const X = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k < n; k++) {
    const p0 = pt(k / n), p1 = pt((k + 1) / n);
    const len = p0.distanceTo(p1);
    const dir = p1.clone().sub(p0).normalize();
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    B.add('iron', box(len, 0.018, 0.018, C('#3a3028')), new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(X, dir), new THREE.Vector3(1, 1, 1)));
    const c = cols[k % cols.length];
    const w = len * 0.8, h = 0.34;
    const l = mid.clone().addScaledVector(dir, -w / 2), rr = mid.clone().addScaledVector(dir, w / 2), tip = mid.clone().add(new THREE.Vector3(0, -h, 0));
    B.add('plain', tri([l.toArray(), rr.toArray(), tip.toArray()], [[0, 0], [1, 0], [0.5, 1]], c));
    B.add('plain', tri([rr.toArray(), l.toArray(), tip.toArray()], [[0, 0], [1, 0], [0.5, 1]], c));
  }
}

/** A villager, low-poly (read at a distance): robe, belt, arms, head, hood or hat. Origin at the feet, facing +z. */
const ROBES = ['#7a2f2a', '#2f4f7a', '#4a6a34', '#8a6a3a', '#5a3a6a', '#a8743a', '#2f6a6a', '#6a6a72'].map(C);
const SKIN = ['#e8b896', '#c89070', '#f0c8a8', '#a87050'].map(C);
export function villager(B, m, r, o = {}) {
  const robe = o.robe || ROBES[Math.floor(r() * ROBES.length)];
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const h = o.height ?? 0.95 + r() * 0.1;
  const S = (x, y, z) => m.clone().multiply(M(x * h, y * h, z * h, 0, 0, 0, h));
  const prof = [[0, 0], [0.29, 0], [0.28, 0.2], [0.23, 0.55], [0.18, 0.88], [0.2, 1.12], [0.225, 1.28], [0.16, 1.38], [0.06, 1.43], [0, 1.44]];
  B.add('plain', paint(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 10), robe), S(0, 0, 0));
  B.add('plain', cyl(0.19, 0.19, 0.06, 10, C('#3a2a1e')), S(0, 0.9, 0));
  if (o.apron) B.add('plain', box(0.3, 0.55, 0.02, C('#e8e0cc')), S(0, 0.62, 0.2).multiply(M(-0.08, 0, 0)));
  for (const sx of [-1, 1]) {
    const arm = cyl(0.045, 0.06, 0.52, 6, robe.clone().multiplyScalar(0.9));
    B.add('plain', arm, S(sx * 0.25, 1.06, 0.03).multiply(M(0.15, 0, sx * 0.12)));
    B.add('plain', blob(0.045, skin, 0), S(sx * 0.28, 0.8, 0.07));
  }
  B.add('plain', blob(0.115, skin, 1), S(0, 1.56, 0));
  const hair = C(['#3a2a1e', '#6a4a2a', '#c8a060', '#1e1a18', '#8a8078'][Math.floor(r() * 5)]);
  if (o.hood) B.add('plain', blob(0.14, robe.clone().multiplyScalar(0.85), 1), S(0, 1.6, -0.03).multiply(M(0, 0, 0, 0, 0, 0, 1)));
  else if (r() < 0.4) {
    B.add('plain', cyl(0.24, 0.24, 0.02, 12, C('#8a6a3a')), S(0, 1.64, 0));
    B.add('plain', cyl(0.1, 0.12, 0.12, 10, C('#8a6a3a')), S(0, 1.7, 0));
  } else B.add('plain', blob(0.122, hair, 1), S(0, 1.6, -0.025));
}

/** A floating quest marker ("!"), golden; returns its geometry centred on the origin (animated in world.js). */
export function questMark() {
  const bar = new THREE.Shape();
  bar.moveTo(-0.065, -0.05); bar.lineTo(0.065, -0.05); bar.lineTo(0.13, 0.5); bar.quadraticCurveTo(0, 0.6, -0.13, 0.5); bar.lineTo(-0.065, -0.05);
  const dot = new THREE.Shape();
  dot.absarc(0, -0.27, 0.095, 0, Math.PI * 2, false);
  return mergeGeometries([extrude(bar, 0.09, WHITE, 6), extrude(dot, 0.09, WHITE, 12)].map(clean));
}

/** A signpost with three arrow boards. Origin at its foot. */
export function signpost(B, m, r) {
  B.add('timber', box(0.14, 2.6, 0.14, PALETTE.timber), m.clone().multiply(M(0, 1.3, 0)));
  for (const [y, ry] of [[2.3, 0.3], [1.95, -1.9], [1.62, 1.1]]) {
    const a = new THREE.Shape();
    a.moveTo(0.05, -0.11); a.lineTo(0.8, -0.11); a.lineTo(0.95, 0); a.lineTo(0.8, 0.11); a.lineTo(0.05, 0.11); a.lineTo(0.05, -0.11);
    B.add('planks', extrude(a, 0.04, C('#c8a880').multiplyScalar(0.85 + r() * 0.2), 2), m.clone().multiply(M(0, y, 0, 0, ry, 0)));
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
  B.add('plain', paint(g, C('#c9b080').multiplyScalar(0.8 + r() * 0.2)), m.clone().multiply(M(0, 0, 0, 0, r() * 6, (r() - 0.5) * 0.15)));
}

/** A market stall: counter, posts, a striped awning (cloth row), produce. Front faces +z. */
export function stall(B, m, r, row = 0) {
  const wood = WHITE.clone().multiplyScalar(0.95);
  B.add('planks', box(2.7, 0.95, 1.0, wood, { grain: true }), m.clone().multiply(M(0, 0.475, 0)));
  B.add('timber', box(2.85, 0.08, 1.18, WHITE, { grain: true }), m.clone().multiply(M(0, 0.99, 0)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('timber', box(0.12, sz > 0 ? 2.35 : 2.8, 0.12, WHITE, { grain: true }), m.clone().multiply(M(sx * 1.3, sz > 0 ? 1.175 : 1.4, sz * 0.48)));
  const q = quad([[-1.65, 2.3, 1.15], [1.65, 2.3, 1.15], [1.65, 2.85, -0.62], [-1.65, 2.85, -0.62]], [[0, 1], [1.4, 1], [1.4, 0], [0, 0]], WHITE);
  B.add('awning', awningRow(q, row), m.clone());
  // valance hanging at the front
  const v = quad([[-1.65, 2.02, 1.16], [1.65, 2.02, 1.16], [1.65, 2.3, 1.16], [-1.65, 2.3, 1.16]], [[0, 0.1], [1.4, 0.1], [1.4, 0.0], [0, 0.0]], WHITE);
  B.add('awning', awningRow(v, row), m.clone());
  const fruit = ['#d8402e', '#f29a2e', '#8fbf3a', '#f2cf3a', '#7a2a4a', '#e85a3a'];
  for (let k = 0; k < 4; k++) {
    const cx = -0.97 + k * 0.65;
    B.add('planks', box(0.56, 0.16, 0.5, C('#b08a62'), { grain: true }), m.clone().multiply(M(cx, 1.1, 0.06)));
    const fc = C(fruit[Math.floor(r() * fruit.length)]);
    for (let f = 0; f < 12; f++) B.add('plain', blob(0.07, fc.clone().multiplyScalar(0.8 + r() * 0.35), 0), m.clone().multiply(M(cx - 0.2 + (f % 4) * 0.13, 1.22 + Math.floor(f / 4) * 0.035, -0.1 + Math.floor(f / 4) * 0.15 + (r() - 0.5) * 0.04)));
  }
  sack(B, m.clone().multiply(M(1.78, 0, -0.45)), r);
}

export function well(B, m) {
  const ring = new THREE.CylinderGeometry(1.0, 1.05, 0.95, 28, 1, true);
  scaleUV(ring, Math.PI * 2.05, 0.95);
  B.add('brick', paint(ring, WHITE), m.clone().multiply(M(0, 0.47, 0)));
  const inner = new THREE.CylinderGeometry(0.78, 0.78, 0.95, 28, 1, true);
  inner.scale(-1, 1, 1);
  const inN = inner.attributes.normal;
  for (let i = 0; i < inN.count; i++) inN.setXYZ(i, -inN.getX(i), -inN.getY(i), -inN.getZ(i));
  scaleUV(inner, Math.PI * 1.56, 0.95);
  B.add('brick', paint(inner, WHITE.clone().multiplyScalar(0.5)), m.clone().multiply(M(0, 0.47, 0)));
  const rim = new THREE.RingGeometry(0.75, 1.12, 28, 1);
  rim.rotateX(-Math.PI / 2);
  scaleUV(rim, 2.2, 2.2);
  B.add('ashlar', paint(rim, WHITE.clone().multiplyScalar(0.95)), m.clone().multiply(M(0, 0.96, 0)));
  B.add('iron', paint(new THREE.CircleGeometry(0.78, 20).rotateX(-Math.PI / 2), C('#16222c')), m.clone().multiply(M(0, 0.55, 0)));
  for (const sx of [-1, 1]) B.add('timber', box(0.15, 2.2, 0.15, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.95, 1.5, 0)));
  B.add('timber', cyl(0.065, 0.065, 2.05, 10, WHITE, { swap: true }), m.clone().multiply(M(0, 2.12, 0, 0, 0, Math.PI / 2)));
  const tan = Math.tan(0.75), RD = 1.7, rh = RD / 2 * tan;
  for (const sz of [-1, 1]) {
    const p0 = [-1.35, 2.62 + rh, 0], p1 = [1.35, 2.62 + rh, 0], p2 = [1.35, 2.62 - 0.12, sz * (RD / 2 + 0.18)], p3 = [-1.35, 2.62 - 0.12, sz * (RD / 2 + 0.18)];
    const sl = Math.hypot(RD / 2 + 0.18, rh + 0.12);
    const qq = sz > 0 ? [p0, p3, p2, p1] : [p1, p2, p3, p0];
    B.add('clay', quad(qq, sz > 0 ? [[0, sl], [0, 0], [2.7, 0], [2.7, sl]] : [[2.7, sl], [2.7, 0], [0, 0], [0, sl]], C('#f0c8b0')), m.clone());
    B.add('planks', quad(sz > 0 ? [p0, p1, p2, p3] : [p1, p0, p3, p2], [[0, 0], [2.7, 0], [2.7, sl], [0, sl]], C('#7a6450')), m.clone());
  }
}

export function cart(B, m, r) {
  B.add('planks', box(1.45, 0.08, 2.3, WHITE, { grain: true }), m.clone().multiply(M(0, 0.78, 0)));
  for (const sx of [-1, 1]) B.add('planks', box(0.06, 0.4, 2.3, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.72, 1.0, 0)));
  for (const sz of [-1, 1]) B.add('planks', box(1.45, 0.4, 0.06, WHITE, { grain: true }), m.clone().multiply(M(0, 1.0, sz * 1.13)));
  for (const sx of [-1, 1]) {
    const rim = new THREE.TorusGeometry(0.44, 0.05, 8, 28);
    scaleUV(rim, 2.8, 0.3);
    B.add('timber', paint(rim, WHITE), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, 0, Math.PI / 2, 0)));
    for (let k = 0; k < 8; k++) B.add('timber', box(0.045, 0.82, 0.045, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, (k / 8) * Math.PI, 0, 0)));
    B.add('timber', cyl(0.09, 0.09, 0.17, 10, WHITE), m.clone().multiply(M(sx * 0.84, 0.46, 0.25, 0, 0, Math.PI / 2)));
    B.add('timber', box(0.07, 0.07, 1.7, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.36, 0.62, 1.95, 0.12, 0, 0)));
  }
  B.add('timber', cyl(0.05, 0.05, 1.8, 8, WHITE, { swap: true }), m.clone().multiply(M(0, 0.46, 0.25, 0, 0, Math.PI / 2)));
  for (let k = 0; k < 3; k++) sack(B, m.clone().multiply(M(-0.35 + (k % 2) * 0.6, 0.82, -0.5 + k * 0.42, 0, r() * 3, 0)), r);
  // a heap of hay at the back
  for (let k = 0; k < 5; k++) B.add('plain', blob(0.32 + r() * 0.1, C('#d8b860').multiplyScalar(0.85 + r() * 0.2), 1), m.clone().multiply(M((r() - 0.5) * 0.8, 1.05, 0.55 + (r() - 0.5) * 0.5)));
}

/** A banner pole (the cloth is built in world.js). */
export function bannerPole(B, m) {
  B.add('timber', cyl(0.06, 0.075, 4.6, 10, WHITE), m.clone().multiply(M(0, 2.3, 0)));
  B.add('timber', box(1.1, 0.08, 0.08, WHITE, { grain: true }), m.clone().multiply(M(0.44, 4.25, 0)));
  B.add('glow', cyl(0.0, 0.1, 0.22, 8, C('#e8b866')), m.clone().multiply(M(0, 4.72, 0)));
}

export function woodpile(B, m, r, len = 1.8) {
  for (let row = 0; row < 4; row++) for (let k = 0; k < 7 - row; k++) {
    const rr = 0.09 + r() * 0.03;
    const g = cyl(rr, rr, 0.55 + r() * 0.1, 9, WHITE.clone().multiplyScalar(0.8 + r() * 0.25));
    B.add('bark', g, m.clone().multiply(M(-len / 2 + 0.15 + (k + row * 0.5) * 0.24, 0.1 + row * 0.19, (r() - 0.5) * 0.06, Math.PI / 2, 0, 0)));
  }
}

export function bench(B, m) {
  B.add('planks', box(1.6, 0.07, 0.4, WHITE, { grain: true }), m.clone().multiply(M(0, 0.46, 0)));
  B.add('planks', box(1.6, 0.3, 0.05, WHITE, { grain: true }), m.clone().multiply(M(0, 0.78, -0.2, -0.15, 0, 0)));
  for (const sx of [-1, 1]) B.add('planks', box(0.08, 0.46, 0.36, WHITE, { grain: true }), m.clone().multiply(M(sx * 0.65, 0.23, 0)));
}

export function haybale(B, m, r) {
  B.add('plain', cyl(0.6, 0.6, 1.1, 14, C('#e2c070').multiplyScalar(0.85 + r() * 0.15), {}), m.clone().multiply(M(0, 0.6, 0, 0, 0, Math.PI / 2)));
}

/** An anvil on a stump, for the smithy. */
export function anvil(B, m) {
  B.add('bark', cyl(0.32, 0.36, 0.6, 12, WHITE), m.clone().multiply(M(0, 0.3, 0)));
  const iron = C('#3a3836');
  B.add('iron', box(0.62, 0.16, 0.22, iron), m.clone().multiply(M(0, 0.86, 0)));
  B.add('iron', box(0.28, 0.2, 0.16, iron), m.clone().multiply(M(0, 0.7, 0)));
  B.add('iron', cyl(0.0, 0.08, 0.24, 6, iron), m.clone().multiply(M(0.42, 0.86, 0, 0, 0, -Math.PI / 2)));
}

// ---------------------------------------------------------------------- the chapel tower
/** A square stone bell tower with a slate spire. Local origin at its foot. */
export function bellTower() {
  const B = new Batch();
  const S = 4.4, H = 15;
  const stoneC = new THREE.Color(1, 0.97, 0.92);
  B.add('ashlar', box(S, H, S, stoneC, { bottom: 0.8 }), M(0, H / 2, 0));
  B.add('ashlar', box(S + 0.4, 0.4, S + 0.4, stoneC), M(0, 0.2, 0));
  B.add('ashlar', box(S + 0.3, 0.3, S + 0.3, stoneC), M(0, H - 3.4, 0));
  // belfry openings on every side
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    B.add('darkglass', quad([[-0.55, -1.0, 0], [0.55, -1.0, 0], [0.55, 1.0, 0], [-0.55, 1.0, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], C('#1a1814')),
      M(Math.sin(a) * (S / 2 + 0.01), H - 1.6, Math.cos(a) * (S / 2 + 0.01), 0, a, 0));
    B.add('darkglass', quad([[-0.3, -0.6, 0], [0.3, -0.6, 0], [0.3, 0.6, 0], [-0.3, 0.6, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], C('#ffb45c').multiplyScalar(0.9)),
      M(Math.sin(a) * (S / 2 + 0.01), H - 7.5, Math.cos(a) * (S / 2 + 0.01), 0, a, 0));
  }
  const sp = new THREE.ConeGeometry(S * 0.78, 9, 4, 1);
  sp.rotateY(Math.PI / 4);
  scaleUV(sp, S * 2.4, 9.5);
  B.add('slate', paint(sp, C('#7fa0d0')), M(0, H + 4.5, 0));
  B.add('iron', cyl(0.03, 0.06, 1.6, 6, C('#c8a050')), M(0, H + 9.6, 0));
  return B;
}

// ------------------------------------------------------------------------------------------ trees
/**
 * Leaf cards over a set of clusters ({ c, rad }): cards mostly near each cluster's surface, facing outward
 * with a random roll, carrying a soft normal from the canopy centre and an AO tint (darker low and inside).
 * aCell (vec2) picks one of the 2x2 cells of the leaf atlas.
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
      const ao = 0.42 + 0.58 * Math.pow((p.y - minY) / Math.max(1e-3, maxY - minY), 0.8) * (0.6 + 0.4 * dirv.dot(p.clone().sub(c).normalize()));
      const tint = 0.9 + r() * 0.2;
      const cu = r() < 0.5 ? 0 : 0.5, cv = r() < 0.5 ? 0 : 0.5;
      for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        tmp.copy(p).addScaledVector(ax, a * sz).addScaledVector(ay, b * sz);
        pos.push(tmp.x, tmp.y, tmp.z);
        nor.push(sn.x, sn.y, sn.z);
        uv.push(cu + (a + 0.5) * 0.5, cv + (b + 0.5) * 0.5);
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
  const lean = new THREE.Vector3((r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4).normalize();
  const trunkTop = lean.clone().multiplyScalar(h * 0.62);
  const tg = new THREE.CylinderGeometry(0.16 + h * 0.02, 0.24 + h * 0.035, h * 0.66, 9, 4);
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
  const crown = trunkTop.clone().add(new THREE.Vector3(0, h * 0.2, 0));
  const cl = [];
  for (let k = 0; k < clusters; k++) {
    const a = (k / clusters) * Math.PI * 2 + r() * 0.8;
    const dist = k === 0 ? 0 : spread * (0.45 + r() * 0.45);
    const c = crown.clone().add(new THREE.Vector3(Math.cos(a) * dist, (r() - 0.35) * spread * 0.55 + (k === 0 ? spread * 0.25 : 0), Math.sin(a) * dist));
    const rad = spread * (0.55 + r() * 0.3) * (k === 0 ? 1.15 : 1);
    cl.push({ c, rad });
    if (k > 0) {
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
  const leaves = leafCards(r, cl, cardSize, density, centre);
  const proxy = [];
  for (const { c, rad } of cl) {
    const g = new THREE.IcosahedronGeometry(rad * 0.85, 0);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g.translate(c.x, c.y, c.z);
    proxy.push(g);
  }
  return { trunk, leaves, proxy: mergeGeometries(proxy), top: Math.max(...cl.map(({ c, rad }) => c.y + rad)) };
}
