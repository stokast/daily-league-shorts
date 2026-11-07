// LAST PERIOD (made-up game). School zombie horror title: a dark hallway in one-point perspective,
// flickering fluorescent tubes, lockers, a red EXIT sign over an open door, student zombies backlit
// at the far end. The hallway is projected from world coordinates (metres), lit per element.
import * as K from './kit.js';

export const meta = { id: 'zombie', title: 'LAST PERIOD', aspect: 16 / 9 };

const flush = (c) => { c.getContext('2d').getImageData(0, 0, 1, 1); return c; };
const hexRgb = (hx) => { const v = parseInt(hx.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };

// world
const EH = 1.55, HW = 2.2, CEIL = 3.0, ZEND = 11.2, ZNEAR = 1.05;
// fluorescent tubes: 0 = dead, 1 = steady, 2 = flickering (its light is a separate additive layer)
const LIGHTS = [{ z: 2.7, on: 0 }, { z: 5.3, on: 2 }, { z: 7.9, on: 1 }, { z: 10.3, on: 1 }];
const FLICK_Z = 5.3;
const FOG = [16, 38, 32];

const contrib = (lz, x, y, z) => {
  const dy = CEIL - y, dz = z - lz, d2 = x * x * 0.45 + dy * dy * 0.22 + dz * dz;
  return 1.3 * Math.exp(-d2 / 2.3) + 0.42 / (1 + d2 * 0.22); // pool + long tail
};
const doorLight = (x, y, z) => 0.95 * Math.exp(-(ZEND - z) * 0.62);
function lightAt(x, y, z, mode) {
  if (mode === 'flick') return contrib(FLICK_Z, x, y, z);
  let v = 0.07;
  for (const L of LIGHTS) if (L.on === 1) v += contrib(L.z, x, y, z);
  return v + doorLight(x, y, z);
}
const fogT = (z) => K.clamp(1 - Math.exp(-Math.max(0, z - 1.6) / 6)) * 0.85;
function shade(rgb, x, y, z, mode) {
  const L = lightAt(x, y, z, mode), f = fogT(z);
  const add = mode === 'flick' ? [0, 0, 0] : FOG.map((c) => c * f);
  const c = rgb.map((v, i) => Math.min(255, Math.round(v * L * (1 - f) + add[i])));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Zombie silhouettes, art-directed per body. Units of body height, feet at y = 0, up is negative.
// legs/arms: polylines; torso: polygon; head: [x, y, tilt].
const ZOMBIES = [
  { // turned toward the camera's left, both arms out
    x: 1.45, z: 6.1, hgt: 1.7, ph: 2.3, sp: 0.7,
    legs: [[[0.0, -0.47], [-0.05, -0.25], [-0.11, -0.01]], [[0.02, -0.47], [0.07, -0.26], [0.1, -0.03]]],
    torso: [[-0.08, -0.45], [0.08, -0.45], [0.1, -0.62], [0.09, -0.78], [-0.02, -0.83], [-0.12, -0.79], [-0.11, -0.62]],
    arms: [[[-0.05, -0.78], [-0.25, -0.77], [-0.43, -0.75]], [[0.02, -0.76], [-0.2, -0.72], [-0.39, -0.7]]],
    head: [-0.09, -0.88, -0.35], hood: true,
  },
  { // front, hunched, arms spread to grab
    x: -0.5, z: 7.0, hgt: 1.74, ph: 0.0, sp: 1.1,
    legs: [[[-0.05, -0.47], [-0.07, -0.25], [-0.09, -0.01]], [[0.05, -0.47], [0.1, -0.27], [0.13, -0.05]]],
    torso: [[-0.12, -0.45], [-0.08, -0.4], [-0.03, -0.45], [0.02, -0.39], [0.07, -0.45], [0.12, -0.42], [0.13, -0.47], [0.16, -0.62], [0.18, -0.76], [0.05, -0.81], [-0.06, -0.82], [-0.16, -0.79], [-0.15, -0.62]],
    arms: [[[-0.15, -0.77], [-0.29, -0.7], [-0.37, -0.63]], [[0.17, -0.75], [0.3, -0.69], [0.37, -0.61]]],
    head: [0.04, -0.85, 0.5],
  },
  { // turned toward the camera's right, arms straight out, ponytail + skirt
    x: 0.95, z: 8.3, hgt: 1.6, ph: 1.7, sp: 0.85,
    legs: [[[-0.01, -0.47], [0.05, -0.25], [0.1, -0.01]], [[0.01, -0.47], [-0.05, -0.24], [-0.1, -0.03]]],
    torso: [[-0.08, -0.45], [0.08, -0.45], [0.11, -0.62], [0.11, -0.78], [0.01, -0.82], [-0.09, -0.78], [-0.1, -0.62]],
    arms: [[[0.04, -0.78], [0.24, -0.77], [0.42, -0.76]], [[-0.02, -0.76], [0.2, -0.72], [0.38, -0.71]]],
    head: [0.1, -0.88, 0.25], ponytail: true, skirt: true,
  },
  { // front, slumped, one arm dragging, backpack
    x: -1.3, z: 9.3, hgt: 1.8, ph: 3.1, sp: 0.95,
    legs: [[[-0.05, -0.47], [-0.09, -0.24], [-0.11, -0.01]], [[0.05, -0.47], [0.06, -0.25], [0.1, -0.01]]],
    torso: [[-0.12, -0.45], [0.12, -0.45], [0.15, -0.62], [0.17, -0.74], [0.05, -0.79], [-0.06, -0.8], [-0.16, -0.78], [-0.15, -0.62]],
    arms: [[[-0.15, -0.76], [-0.21, -0.58], [-0.24, -0.4]], [[0.16, -0.73], [0.3, -0.72], [0.43, -0.77]]],
    head: [-0.02, -0.82, -0.6], backpack: true,
  },
  { // far, in the doorway, arms raised forward
    x: 0.12, z: 10.2, hgt: 1.7, ph: 4.4, sp: 1.25,
    legs: [[[-0.05, -0.47], [-0.06, -0.25], [-0.08, -0.01]], [[0.05, -0.47], [0.06, -0.25], [0.09, -0.01]]],
    torso: [[-0.12, -0.45], [0.12, -0.45], [0.15, -0.62], [0.16, -0.78], [-0.15, -0.79], [-0.15, -0.62]],
    arms: [[[-0.15, -0.78], [-0.27, -0.76], [-0.36, -0.82]], [[0.15, -0.78], [0.27, -0.76], [0.36, -0.82]]],
    head: [0.0, -0.88, -0.2], cap: true,
  },
];

function drawZombieMask(g, z) {
  g.fillStyle = '#000'; g.strokeStyle = '#000';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const seg = (pts, wd) => { g.lineWidth = wd; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  for (const leg of z.legs) {
    seg(leg, 0.07);
    const [fx, fy] = leg[2];
    poly([[fx - 0.05, fy + 0.01], [fx + 0.05, fy + 0.01], [fx + 0.04, fy - 0.035], [fx - 0.04, fy - 0.035]]);
  }
  if (z.skirt) poly([[-0.13, -0.35], [0.14, -0.36], [0.1, -0.5], [-0.1, -0.5]]);
  poly(z.torso);
  if (z.backpack) poly([[0.12, -0.48], [0.21, -0.5], [0.22, -0.74], [0.14, -0.76]]);
  for (const arm of z.arms) {
    seg(arm, 0.05);
    const [ex, ey] = arm[1], [hx, hy] = arm[2];
    const dx = hx - ex, dy = hy - ey, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    // limp hand with clawed fingers hanging off the wrist
    seg([[hx, hy], [hx + ux * 0.03, hy + uy * 0.03 + 0.03]], 0.038);
    for (const f of [-1, 0, 1]) seg([[hx + ux * 0.03, hy + 0.03], [hx + ux * 0.045 + f * 0.018, hy + 0.075]], 0.013);
  }
  const [hx, hy, tilt] = z.head;
  seg([[hx * 0.4, -0.8], [hx, hy + 0.03]], 0.055);
  g.save();
  g.translate(hx, hy); g.rotate(tilt);
  g.beginPath(); g.ellipse(0, -0.02, 0.06, 0.074, 0, 0, K.TAU); g.fill();
  if (z.hood) { g.beginPath(); g.ellipse(0, -0.005, 0.083, 0.094, 0, 0, K.TAU); g.fill(); }
  if (z.cap) poly([[-0.07, -0.06], [0.06, -0.085], [0.15, -0.045], [0.06, -0.045], [-0.07, -0.03]]);
  if (z.ponytail) seg([[-0.05, -0.06], [-0.11, -0.02], [-0.12, 0.06]], 0.034);
  for (let k = -2; k <= 2; k++) seg([[k * 0.024, -0.08], [k * 0.03 + 0.012, -0.104]], 0.018);
  g.restore();
}

export function create(w, h) {
  const s = w / 1280;
  const F = 520 * s, VX = 640 * s, VY = 300 * s;
  const PX = (x, y, z) => [VX + (F * x) / z, VY - (F * (y - EH)) / z];
  const quad = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
  // planar quads (world corners)
  const wallQ = (sx, z0, z1, y0, y1) => [PX(sx * HW, y0, z0), PX(sx * HW, y0, z1), PX(sx * HW, y1, z1), PX(sx * HW, y1, z0)];
  const floorQ = (x0, x1, z0, z1, y = 0) => [PX(x0, y, z0), PX(x1, y, z0), PX(x1, y, z1), PX(x0, y, z1)];

  // ------------------------------------------------------------ the hallway (two lighting passes)
  const C = {
    locker: hexRgb('#4a9a86'), lockerDark: hexRgb('#123029'), vent: hexRgb('#081a16'), handle: hexRgb('#c9e3d6'),
    wall: hexRgb('#9dbba3'), trim: hexRgb('#4f6d5c'), ceil: hexRgb('#5f726a'), ceilLine: hexRgb('#2a3631'),
    tileA: hexRgb('#a9cbb6'), tileB: hexRgb('#1b332e'), base: hexRgb('#0f2420'), endWall: hexRgb('#7d9f8a'),
    plate: hexRgb('#d9e6dc'),
  };
  const drawHall = (g, mode) => {
    // ceiling tiles
    for (let z = ZNEAR; z < ZEND; z += 0.6) {
      for (let x = -HW; x < HW - 0.01; x += 0.55) {
        const q = floorQ(x, x + 0.55, z, Math.min(ZEND, z + 0.6), CEIL);
        quad(g, q, shade(C.ceil, x + 0.27, CEIL, z + 0.3, mode));
      }
    }
    g.strokeStyle = mode === 'flick' ? 'rgba(0,0,0,0.35)' : 'rgba(10,20,17,0.6)'; g.lineWidth = 1.2 * s;
    g.beginPath();
    for (let z = ZNEAR; z <= ZEND; z += 0.6) { const [a, ay] = PX(-HW, CEIL, z), [b] = PX(HW, CEIL, z); g.moveTo(a, ay); g.lineTo(b, ay); }
    for (let x = -HW; x <= HW + 0.01; x += 0.55) { const [a, ay] = PX(x, CEIL, ZNEAR), [b, by] = PX(x, CEIL, ZEND); g.moveTo(a, ay); g.lineTo(b, by); }
    g.stroke();
    // floor: glossy checker
    for (let z = ZNEAR; z < ZEND; z += 0.5) {
      let k = Math.round(z / 0.5);
      for (let x = -HW; x < HW - 0.01; x += 0.55) {
        const q = floorQ(x, x + 0.55, z, Math.min(ZEND, z + 0.5));
        quad(g, q, shade(k++ % 2 ? C.tileA : C.tileB, x + 0.27, 0, z + 0.25, mode));
      }
    }
    // side walls: upper wall, lockers, baseboard
    for (const sx of [-1, 1]) {
      for (let z = ZNEAR - 0.6; z < ZEND; z += 0.4) {
        const z0 = Math.max(0.5, z), z1 = Math.min(ZEND, z + 0.4);
        quad(g, wallQ(sx, z0, z1, 1.98, CEIL), shade(C.wall, sx * HW, 2.5, z0 + 0.2, mode));
        quad(g, wallQ(sx, z0, z1, 1.92, 2.0), shade(C.trim, sx * HW, 1.96, z0 + 0.2, mode));
        quad(g, wallQ(sx, z0, z1, 0, 0.12), shade(C.base, sx * HW, 0.06, z0 + 0.2, mode));
        // locker door
        quad(g, wallQ(sx, z0, z1, 0.12, 1.92), shade(C.lockerDark, sx * HW, 1, z0 + 0.2, mode));
        const zi = z0 + 0.025, zo = z1 - 0.025, seed = Math.round(z * 10) + (sx > 0 ? 500 : 0);
        const dent = K.hash(seed, 3);
        const tint = dent < 0.12 ? C.lockerDark.map((v, i) => (v + C.locker[i]) / 2) : C.locker;
        quad(g, wallQ(sx, zi, zo, 0.15, 1.9), shade(tint, sx * HW, 1.1, z0 + 0.2, mode));
        // vents
        for (let v = 0; v < 4; v++) quad(g, wallQ(sx, zi + 0.07, zo - 0.07, 1.62 + v * 0.06, 1.645 + v * 0.06), shade(C.vent, sx * HW, 1.7, z0 + 0.2, mode));
        for (let v = 0; v < 3; v++) quad(g, wallQ(sx, zi + 0.07, zo - 0.07, 0.25 + v * 0.06, 0.275 + v * 0.06), shade(C.vent, sx * HW, 0.3, z0 + 0.2, mode));
        // handle + number plate
        const hz = sx < 0 ? zo - 0.09 : zi + 0.055; // handle on the door's right-hand edge
        quad(g, wallQ(sx, hz, hz + 0.035, 0.95, 1.18), shade(C.handle, sx * HW, 1, z0, mode));
        quad(g, wallQ(sx, zi + 0.12, zo - 0.12, 1.78, 1.84), shade(C.plate, sx * HW, 1.8, z0, mode));
      }
    }
    // far end wall with an open double door full of light
    const ew = [PX(-HW, 0, ZEND), PX(HW, 0, ZEND), PX(HW, CEIL, ZEND), PX(-HW, CEIL, ZEND)];
    quad(g, ew, shade(C.endWall, 0, 1.5, ZEND, mode));
    if (mode !== 'flick') {
      const [dx0, dy0] = PX(-0.95, 2.2, ZEND), [dx1, dy1] = PX(0.95, 0, ZEND);
      g.fillStyle = K.linGrad(g, 0, dy0, 0, dy1, [[0, '#c9ffe0'], [0.6, '#e8fff0'], [1, '#9bf5c4']]);
      g.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
      // door leaves swung open into the room beyond
      for (const sx of [-1, 1]) {
        const a = PX(sx * 0.95, 0, ZEND), b = PX(sx * 0.95, 2.2, ZEND), c2 = PX(sx * 0.45, 2.2, ZEND + 0.75), d = PX(sx * 0.45, 0, ZEND + 0.75);
        quad(g, [a, b, c2, d], 'rgba(40,90,70,0.85)');
        const wa = PX(sx * 0.85, 1.9, ZEND + 0.15), wb = PX(sx * 0.6, 1.9, ZEND + 0.55), wc = PX(sx * 0.6, 1.2, ZEND + 0.55), wd = PX(sx * 0.85, 1.2, ZEND + 0.15);
        quad(g, [wa, wb, wc, wd], 'rgba(220,255,235,0.9)');
      }
      // EXIT sign over the door
      const [ex0, ey0] = PX(-0.55, 2.78, ZEND - 0.05), [ex1, ey1] = PX(0.55, 2.34, ZEND - 0.05);
      g.fillStyle = '#1a0606'; g.fillRect(ex0 - 2 * s, ey0 - 2 * s, ex1 - ex0 + 4 * s, ey1 - ey0 + 4 * s);
      g.fillStyle = '#ff2b2b'; g.fillRect(ex0, ey0, ex1 - ex0, ey1 - ey0);
      g.fillStyle = '#fff1ee'; g.font = K.font(900, (ey1 - ey0) * 0.78, 'Inter'); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('EXIT', (ex0 + ex1) / 2, (ey0 + ey1) / 2 + 1 * s);
    }
    // fluorescent tubes
    for (const Lt of LIGHTS) {
      const lz = Lt.z, lit = mode === 'flick' ? Lt.on === 2 : Lt.on === 1;
      const q = floorQ(-0.34, 0.34, lz - 0.62, lz + 0.62, CEIL - 0.02);
      const frame = floorQ(-0.4, 0.4, lz - 0.68, lz + 0.68, CEIL - 0.01);
      if (mode !== 'flick') quad(g, frame, shade(C.ceilLine, 0, CEIL, lz, mode));
      if (lit) quad(g, q, mode === 'flick' ? '#d8ffe8' : `rgb(${Math.round(225 - fogT(lz) * 60)},255,${Math.round(236 - fogT(lz) * 40)})`);
      else if (mode !== 'flick') {
        quad(g, q, shade([70, 88, 80], 0, CEIL, lz, mode));
        for (const tx of [-0.2, 0, 0.2]) quad(g, floorQ(tx - 0.04, tx + 0.04, lz - 0.6, lz + 0.6, CEIL - 0.03), shade([120, 140, 130], 0, CEIL, lz, mode));
      }
    }
  };
  // glows that ride on top of the lit geometry
  const drawGlows = (g, mode) => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    LIGHTS.forEach(({ z: lz, on: st }) => {
      if (!(mode === 'flick' ? st === 2 : st === 1)) return;
      const [cx, cy] = PX(0, CEIL, lz), r = (F * 1.1) / lz, k = 1 - fogT(lz) * 0.6;
      g.save(); g.translate(cx, cy); g.scale(1.5, 0.55);
      g.fillStyle = K.radGrad(g, 0, 0, 0, r, [[0, `rgba(190,255,220,${0.5 * k})`], [0.4, `rgba(120,230,180,${0.16 * k})`], [1, 'rgba(80,200,150,0)']]);
      g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
      // reflection on the glossy floor
      const [rx, ry] = PX(0, -CEIL + 0.3, lz), rr = (F * 0.9) / lz;
      g.save(); g.translate(rx, ry); g.scale(0.55, 1.4);
      g.fillStyle = K.radGrad(g, 0, 0, 0, rr, [[0, `rgba(200,255,225,${0.32 * k})`], [1, 'rgba(120,220,170,0)']]);
      g.fillRect(-rr, -rr, 2 * rr, 2 * rr); g.restore();
    });
    if (mode !== 'flick') {
      // doorway bloom, its spill down the floor, EXIT glow + reflection
      const [dx, dy] = PX(0, 1.1, ZEND);
      g.fillStyle = K.radGrad(g, dx, dy, 0, 330 * s, [[0, 'rgba(170,255,210,0.55)'], [0.3, 'rgba(90,200,150,0.2)'], [1, 'rgba(40,120,90,0)']]);
      g.fillRect(dx - 330 * s, dy - 330 * s, 660 * s, 660 * s);
      const sp0 = PX(-0.9, 0, ZEND), sp1 = PX(0.9, 0, ZEND), sp2 = PX(1.6, 0, 3.5), sp3 = PX(-1.6, 0, 3.5);
      g.fillStyle = K.linGrad(g, 0, sp0[1], 0, sp2[1], [[0, 'rgba(160,255,200,0.28)'], [1, 'rgba(160,255,200,0)']]);
      quad(g, [sp0, sp1, sp2, sp3], g.fillStyle);
      const [ex, ey] = PX(0, 2.56, ZEND - 0.05);
      g.fillStyle = K.radGrad(g, ex, ey, 0, 70 * s, [[0, 'rgba(255,40,40,0.6)'], [1, 'rgba(255,0,0,0)']]);
      g.fillRect(ex - 70 * s, ey - 70 * s, 140 * s, 140 * s);
      const [erx, ery] = PX(0, -2.56, ZEND - 0.05);
      g.save(); g.translate(erx, ery); g.scale(0.5, 1.6);
      g.fillStyle = K.radGrad(g, 0, 0, 0, 40 * s, [[0, 'rgba(255,40,40,0.35)'], [1, 'rgba(255,0,0,0)']]);
      g.fillRect(-40 * s, -40 * s, 80 * s, 80 * s); g.restore();
    }
    g.restore();
  };

  // flickering tube's light, cropped to where it lands, added in fg
  const flickFull = K.makeCanvas(w, h);
  {
    const g = flickFull.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    drawHall(g, 'flick');
    drawGlows(g, 'flick');
  }
  let flick, fx0 = 0, fy0 = 0;
  {
    const d = flickFull.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    fx0 = Math.max(0, x0 - 2); fy0 = Math.max(0, y0 - 2);
    flick = K.makeCanvas(Math.min(w, x1 + 3) - fx0, Math.min(h, y1 + 3) - fy0);
    flick.getContext('2d').drawImage(flickFull, -fx0, -fy0);
  }
  // ------------------------------------------------------------ zombies (rim-lit silhouettes)
  const zSprites = ZOMBIES.map((z) => {
    const hp = Math.ceil((F * z.hgt) / (z.z - 1.4)) + 4;      // largest size it reaches
    const W = Math.ceil(hp * 1.1), H = Math.ceil(hp * 1.12);
    const mask = K.makeCanvas(W, H), mg = mask.getContext('2d');
    mg.translate(W / 2, H - 2); mg.scale(hp, hp);
    drawZombieMask(mg, z);
    const tint = (col) => { const c = K.makeCanvas(W, H), g = c.getContext('2d'); g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, W, H); return c; };
    const f = fogT(z.z) * 0.55;
    const rim = tint('#b6ffd8'), body = tint(`rgb(${Math.round(6 + 40 * f)},${Math.round(17 + 80 * f)},${Math.round(15 + 68 * f)})`);
    const out = K.makeCanvas(W, H), og = out.getContext('2d');
    const o = Math.max(1, hp * 0.012);
    og.globalAlpha = 0.85;
    og.drawImage(rim, -o, -o * 0.6); og.drawImage(rim, o, -o * 0.6); og.drawImage(rim, 0, -o * 1.2);
    og.globalAlpha = 1;
    og.drawImage(body, 0, 0);
    return { cv: flush(out), hp, W, H };
  });
  const mist = K.makeCanvas(256, 64);
  {
    const g = mist.getContext('2d');
    g.save(); g.scale(1, 0.25);
    g.fillStyle = K.radGrad(g, 128, 128, 0, 128, [[0, 'rgba(170,240,205,0.5)'], [0.5, 'rgba(140,220,185,0.22)'], [1, 'rgba(120,200,170,0)']]);
    g.fillRect(0, 0, 256, 256); g.restore();
  }
  const exitGlow = K.makeCanvas(160 * s, 160 * s);
  {
    const g = exitGlow.getContext('2d');
    g.fillStyle = K.radGrad(g, 80 * s, 80 * s, 0, 80 * s, [[0, 'rgba(255,60,50,0.9)'], [0.35, 'rgba(255,20,20,0.3)'], [1, 'rgba(255,0,0,0)']]);
    g.fillRect(0, 0, 160 * s, 160 * s);
  }
  const zShadow = K.makeCanvas(64, 64);
  {
    const g = zShadow.getContext('2d');
    g.fillStyle = K.radGrad(g, 32, 32, 0, 32, [[0, 'rgba(0,8,6,0.75)'], [1, 'rgba(0,8,6,0)']]);
    g.fillRect(0, 0, 64, 64);
  }

  // ------------------------------------------------------------ dust mote
  const mote = K.makeCanvas(16, 16);
  {
    const g = mote.getContext('2d');
    g.fillStyle = K.radGrad(g, 8, 8, 0, 8, [[0, 'rgba(220,255,235,0.9)'], [1, 'rgba(220,255,235,0)']]);
    g.fillRect(0, 0, 16, 16);
  }

  // ------------------------------------------------------------ logo, tagline, prompt
  const LOGO_W = Math.ceil(1240 * s), LOGO_H = Math.ceil(300 * s), LB = 196 * s;
  const logo = K.makeCanvas(LOGO_W, LOGO_H), lg = logo.getContext('2d');
  const lpx = K.fitFont(lg, 'LAST PERIOD', 1060 * s, 178 * s, 'Creepster', 400, 0.03);
  const logoOpts = {
    font: K.font(400, lpx, 'Creepster'), tracking: 0.03,
    fill: (g, top, bottom) => K.linGrad(g, 0, top, 0, bottom, [[0, '#ff7a5c'], [0.22, '#f0261f'], [0.62, '#a80b15'], [1, '#520008']]),
    outlines: [[16 * s, '#060000'], [5 * s, '#3d0004']],
    extrude: { dx: 3 * s, dy: 10 * s, steps: 10, color: '#040000' },
    glow: { color: 'rgba(170,0,8,0.85)', blur: 34 * s },
    highlight: { color: 'rgba(255,190,170,0.28)', height: 0.2 },
  };
  K.logoText(lg, 'LAST PERIOD', LOGO_W / 2, LB, logoOpts);
  // drip sources: where the letters sit on the baseline
  const drips = [];
  {
    const m = K.makeCanvas(LOGO_W, LOGO_H), mg = m.getContext('2d');
    K.logoText(mg, 'LAST PERIOD', LOGO_W / 2, LB, { ...logoOpts, outlines: [], extrude: null, glow: null, highlight: null, fill: '#fff' });
    const yRow = Math.round(LB - 4 * s);
    const row = mg.getImageData(0, yRow, LOGO_W, 1).data;
    const runs = [];
    let st = -1;
    for (let x = 0; x <= LOGO_W; x++) {
      const on = x < LOGO_W && row[x * 4 + 3] > 128;
      if (on && st < 0) st = x;
      if (!on && st >= 0) { if (x - st > 6 * s) runs.push([st, x]); st = -1; }
    }
    runs.forEach(([a, b], i) => {
      if (K.hash(i, 77) < 0.42) return;
      const r = K.rng(900 + i);
      drips.push({ x: a + (b - a) * (0.3 + r() * 0.4), y: yRow, len: (16 + r() * 34) * s, wd: (4 + r() * 4) * s, t0: 0.55 + r() * 1.4, dur: 2.5 + r() * 5, drop: 2.5 + r() * 3.5 });
    });
  }
  const tag = K.makeCanvas(760 * s, 90 * s);
  {
    const g = tag.getContext('2d');
    const str = "school's out. forever";
    g.font = K.font(700, 36 * s, 'Inter'); g.textBaseline = 'middle';
    const widths = [...str].map((ch) => g.measureText(ch).width), gap = 0.06 * 36 * s;
    const total = widths.reduce((x, y) => x + y, 0) + gap * (widths.length - 1) + g.measureText('.').width + gap;
    const x0 = (tag.width - total) / 2, y0 = tag.height / 2;
    g.fillStyle = 'rgba(0,0,0,0.85)'; K.spacedText(g, str, x0 + 2 * s, y0 + 3 * s, 0.06, 'left');
    g.fillStyle = '#dff3e6'; const w0 = K.spacedText(g, str, x0, y0, 0.06, 'left');
    g.fillStyle = '#e0141e'; g.fillText('.', x0 + w0 + gap, y0);
  }
  const press = K.makeCanvas(420 * s, 50 * s);
  {
    const g = press.getContext('2d');
    g.font = K.font(700, 19 * s, 'Inter'); g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.7)'; K.spacedText(g, 'PRESS START', press.width / 2 + 2 * s, press.height / 2 + 2 * s, 0.45);
    g.fillStyle = '#cfeedd'; K.spacedText(g, 'PRESS START', press.width / 2, press.height / 2, 0.45);
  }
  [logo, flick, tag, press, mote, zShadow, exitGlow, mist].forEach(flush);

  // clock (face in bg, hands in fg)
  const CLK = PX(-1.75, 2.42, 3.2), CLR = (F * 0.2) / 3.2;

  return {
    bg(ctx) {
      ctx.save();
      ctx.fillStyle = '#0a1513'; ctx.fillRect(0, 0, w, h);
      drawHall(ctx, 'base');
      // NO RUNNING sign on the right wall (affine-mapped onto the wall plane)
      {
        const [ax, ay] = PX(HW, 2.62, 3.75), [bx, by] = PX(HW, 2.62, 2.9), [cx, cy] = PX(HW, 2.22, 3.75);
        ctx.save();
        ctx.transform((bx - ax) / 100, (by - ay) / 100, (cx - ax) / 40, (cy - ay) / 40, ax, ay);
        const sl = Math.max(0.42, lightAt(HW, 2.4, 3.3, 'base'));
        const sc = (r, g2, b) => `rgb(${Math.round(r * sl)},${Math.round(g2 * sl)},${Math.round(b * sl)})`;
        ctx.fillStyle = sc(225, 230, 210); ctx.fillRect(0, 0, 100, 40);
        ctx.fillStyle = sc(190, 30, 30); ctx.fillRect(3, 3, 94, 34);
        ctx.fillStyle = sc(250, 248, 236);
        ctx.font = K.font(900, 15, 'Inter'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('NO RUNNING', 50, 21);
        ctx.restore();
      }
      // flyers on the left wall
      for (const [z0, z1, y0, y1, col] of [[4.2, 4.65, 2.15, 2.6, [220, 200, 120]], [4.8, 5.15, 2.25, 2.55, [200, 120, 130]], [6.4, 6.9, 2.12, 2.55, [170, 200, 230]]]) {
        quad(ctx, wallQ(-1, z0, z1, y0, y1), shade(col, -HW, 2.4, z0, 'base'));
      }
      drawGlows(ctx, 'base');
      // hallway clock (double-sided, hangs off the wall): face + ticks
      {
        const [cx, cy] = CLK;
        const [bx0, by0] = PX(-HW, 2.62, 3.2);
        ctx.strokeStyle = '#0c1714'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(cx - CLR * 0.4, cy - CLR * 0.9); ctx.stroke();
        ctx.fillStyle = '#0d1a17'; ctx.beginPath(); ctx.arc(cx, cy, CLR * 1.12, 0, K.TAU); ctx.fill();
        ctx.fillStyle = K.radGrad(ctx, cx - CLR * 0.3, cy - CLR * 0.3, 0, CLR * 1.3, [[0, '#b9cbbf'], [1, '#5f7569']]);
        ctx.beginPath(); ctx.arc(cx, cy, CLR, 0, K.TAU); ctx.fill();
        ctx.strokeStyle = '#1b2a25'; ctx.lineWidth = 1.6 * s;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * K.TAU;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * CLR * 0.78, cy + Math.sin(a) * CLR * 0.78); ctx.lineTo(cx + Math.cos(a) * CLR * 0.92, cy + Math.sin(a) * CLR * 0.92); ctx.stroke();
        }
      }
      // a dropped backpack and loose papers near the zombies' feet
      {
        const [bx, by] = PX(-1.5, 0, 6.2), u = (F * 0.42) / 6.2;
        const bs = (hx) => shade(hexRgb(hx), -1.5, 0.3, 6.2, 'base');
        ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.16);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(u * 0.05, 0, u * 0.66, u * 0.13, 0, 0, K.TAU); ctx.fill();
        ctx.lineWidth = u * 0.035; ctx.strokeStyle = '#030807';
        ctx.fillStyle = bs('#b8323a'); K.roundRect(ctx, -u * 0.42, -u * 0.86, u * 0.84, u * 0.86, u * 0.22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = bs('#e05a5a'); K.roundRect(ctx, -u * 0.36, -u * 0.8, u * 0.2, u * 0.56, u * 0.08); ctx.fill();
        ctx.fillStyle = bs('#8a1f27'); K.roundRect(ctx, -u * 0.3, -u * 0.44, u * 0.6, u * 0.4, u * 0.1); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = bs('#d8c070'); ctx.lineWidth = u * 0.025; ctx.beginPath(); ctx.moveTo(-u * 0.24, -u * 0.36); ctx.lineTo(u * 0.24, -u * 0.36); ctx.stroke();
        ctx.strokeStyle = '#030807'; ctx.lineWidth = u * 0.07; ctx.beginPath(); ctx.arc(0, -u * 0.86, u * 0.18, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = bs('#6a161d'); ctx.lineWidth = u * 0.06;
        ctx.beginPath(); ctx.moveTo(u * 0.3, -u * 0.7); ctx.quadraticCurveTo(u * 0.75, -u * 0.5, u * 0.62, -u * 0.02); ctx.stroke();
        ctx.restore();
        for (const [x0, z0, rot] of [[-1.05, 6.0, 0.4], [-0.75, 6.5, -0.3], [0.45, 6.4, 0.9], [1.15, 7.3, 1.3], [-0.2, 5.8, 2.1]]) {
          const pts = [[-0.11, -0.15], [0.11, -0.15], [0.11, 0.15], [-0.11, 0.15]].map(([px, pz]) => {
            const c = Math.cos(rot), sn = Math.sin(rot);
            return PX(x0 + px * c - pz * sn, 0.005, z0 + px * sn + pz * c);
          });
          quad(ctx, pts, shade([225, 232, 220], x0, 0, z0, 'base'));
        }
      }
      ctx.fillStyle = K.linGrad(ctx, 0, 430 * s, 0, h, [[0, 'rgba(2,8,6,0)'], [0.55, 'rgba(2,8,6,0.45)'], [1, 'rgba(2,8,6,0.8)']]);
      ctx.fillRect(0, 430 * s, w, h - 430 * s);
      K.vignette(ctx, w, h, 0.7, '2,8,6');
      K.grain(ctx, w, h, 0.07, 9);
      ctx.restore();
    },
    fg(ctx, t) {
      ctx.save();
      // tube flicker: mostly on, with stuttering dropouts
      const k = Math.floor(t * 15);
      const win = Math.floor(t / 1.3), ph = (t / 1.3) % 1;
      let on = 0.92 + 0.08 * K.hash(k, 11);
      if (K.hash(win, 5) < 0.55 && ph > 0.45 && ph < 0.75) on = K.hash(k, 13) < 0.55 ? 0.05 : 0.8;
      if (t < 0.7 && t > 0.1) on = K.hash(Math.floor(t * 22), 17) < 0.5 ? 0.1 : 1;
      if (on > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = on;
        ctx.drawImage(flick, fx0, fy0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // EXIT buzz
      const [ex, ey] = PX(0, 2.56, ZEND - 0.05);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + 0.25 * K.hash(Math.floor(t * 9), 23);
      ctx.drawImage(exitGlow, ex - exitGlow.width / 2, ey - exitGlow.height / 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // zombies, far to near, swaying and creeping closer
      const order = ZOMBIES.map((z, i) => i).sort((a, b) => ZOMBIES[b].z - ZOMBIES[a].z);
      for (const i of order) {
        const z = ZOMBIES[i], sp = zSprites[i];
        const zz = z.z - Math.min(20, t) * 0.035;
        const [fx, fy] = PX(z.x, 0, zz);
        const hpx = (F * z.hgt) / zz, sc = hpx / sp.hp;
        // contact shadow
        ctx.drawImage(zShadow, fx - hpx * 0.22, fy - hpx * 0.04, hpx * 0.44, hpx * 0.08);
        ctx.save();
        ctx.translate(fx, fy + Math.abs(Math.sin(t * z.sp * 2 + z.ph)) * -hpx * 0.012);
        ctx.rotate(Math.sin(t * z.sp + z.ph) * 0.055);
        ctx.drawImage(sp.cv, (-sp.W / 2) * sc, (-sp.H + 2) * sc, sp.W * sc, sp.H * sc);
        ctx.restore();
      }

      // low mist rolling along the floor at the far end
      for (let i = 0; i < 4; i++) {
        const z = 7 + i * 1.1, [, my] = PX(0, 0.1, z), mw = (F * 4.2) / z, mh = (F * 0.5) / z;
        const drift = ((t * (0.05 + i * 0.02) + i * 0.37) % 1) * 2 - 1;
        ctx.globalAlpha = 0.9 - i * 0.12;
        ctx.drawImage(mist, VX + drift * mw * 0.3 - mw / 2, my - mh * 0.6, mw, mh * 1.3);
      }
      ctx.globalAlpha = 1;

      // clock hands: 2:59, second hand ticking toward the bell
      {
        const [cx, cy] = CLK, sec = 38 + Math.floor(t);
        const hand = (a, len, wd, col) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); ctx.stroke(); };
        ctx.lineCap = 'round';
        hand(((2 + 59 / 60) / 12) * K.TAU, CLR * 0.5, 3 * s, '#101a17');
        hand((59 / 60) * K.TAU, CLR * 0.78, 2.2 * s, '#101a17');
        hand((sec / 60) * K.TAU, CLR * 0.82, 1.2 * s, '#c41515');
      }

      // dust drifting through the light
      for (let i = 0; i < 46; i++) {
        const r1 = K.hash(i, 1), r2 = K.hash(i, 2), r3 = K.hash(i, 3);
        const x = (220 + r1 * 840) * s + Math.sin(t * (0.3 + r3 * 0.4) + i) * 18 * s;
        const y = ((60 + r2 * 420 + t * (6 + r3 * 10)) % 440 + 40) * s;
        const sz = (2 + r3 * 4) * s;
        ctx.globalAlpha = (0.25 + 0.5 * r3) * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7));
        ctx.drawImage(mote, x - sz, y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1;

      // logo: flickers on like a dying tube, then bleeds
      const lx = VX - LOGO_W / 2, ly = 360 * s;
      const vis = (t > 0.24 && t < 0.29) || (t > 0.33 && t < 0.37) || t > 0.4;
      if (vis) {
        const jolt = t < 0.5 ? (K.hash(Math.floor(t * 40), 3) - 0.5) * 8 * s : 0;
        ctx.drawImage(logo, lx + jolt, ly);
        ctx.fillStyle = '#9c0812'; ctx.strokeStyle = '#060000'; ctx.lineWidth = 3 * s;
        for (const d of drips) {
          const g = K.easeOutCubic((t - d.t0) / d.dur);
          if (g <= 0) continue;
          const L = d.len * g, x = lx + d.x + jolt, y0 = ly + d.y;
          ctx.beginPath();
          ctx.moveTo(x - d.wd / 2, y0);
          ctx.lineTo(x - d.wd * 0.3, y0 + L);
          ctx.arc(x, y0 + L, d.wd * 0.55, Math.PI, 0, true);
          ctx.lineTo(x + d.wd / 2, y0);
          ctx.closePath();
          ctx.stroke(); ctx.fill();
          // a drop falls now and then
          const fp = ((t - d.t0 - 1) % d.drop) / d.drop;
          if (t > d.t0 + 1 && fp < 0.35) {
            const dy = fp / 0.35;
            ctx.globalAlpha = 1 - dy;
            ctx.beginPath(); ctx.arc(x, y0 + L + d.wd + dy * dy * 40 * s, d.wd * 0.45, 0, K.TAU); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      const ui = K.easeOutCubic((t - 0.6) / 0.5);
      if (ui > 0) {
        ctx.globalAlpha = ui;
        ctx.drawImage(tag, VX - tag.width / 2, 628 * s - tag.height / 2);
        ctx.globalAlpha = ui * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4)));
        ctx.drawImage(press, VX - press.width / 2, 690 * s - press.height / 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  };
}
