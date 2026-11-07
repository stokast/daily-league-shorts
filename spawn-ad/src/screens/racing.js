// NITRO SUNSET (made-up game). Arcade racing title: dusk highway rushing toward the viewer under a
// striped sun, an original wedge supercar seen from behind, chrome italic logo.
import * as K from './kit.js';

export const meta = { id: 'racing', title: 'NITRO SUNSET', aspect: 16 / 9 };

// Chrome rasterizes canvas draw calls lazily; read one pixel so pre-rendered sprites are finished in
// create() instead of on the first fg() frame.
const flush = (c) => { c.getContext('2d').getImageData(0, 0, 1, 1); return c; };

export function create(w, h) {
  const s = w / 1280;
  const HY = Math.round(410 * s);       // horizon
  const VX = w / 2;                     // vanishing point x
  const F = 310 * s;                    // screen y = HY + F / z (camera height 1)
  const ROAD = 3.6, LANE = 2.4;         // road half-width, lane width (3 lanes)
  const SPEED = 14;                     // world units per second
  const P = (x, z) => [VX + (F * x) / z, HY + F / z];
  const Z_BOT = F / (h + 2 - HY);

  // ------------------------------------------------------------ logo (pre-rendered)
  const LOGO_W = Math.ceil(1200 * s), LOGO_H = Math.ceil(330 * s);
  const NITRO_Y = 178 * s, SUNSET_Y = 268 * s;
  const chrome = (c, top, bottom) => K.linGrad(c, 0, top, 0, bottom, [
    [0, '#ffffff'], [0.18, '#d9f1ff'], [0.42, '#7cc0f5'], [0.5, '#2a3d9c'], [0.515, '#140a33'],
    [0.56, '#5a1f6e'], [0.72, '#ff5fa8'], [0.9, '#ffc0e0'], [1, '#fff2fa']]);
  const sunsetFill = (c, top, bottom) => K.linGrad(c, 0, top, 0, bottom, [
    [0, '#fff6b8'], [0.35, '#ffc44d'], [0.62, '#ff7a3d'], [1, '#ff2f7e']]);
  const nitroOpts = {
    font: K.font(400, 196 * s, 'Russo One'), skewX: 0.24, tracking: 0.02,
    fill: chrome,
    outlines: [[20 * s, '#12052b'], [6 * s, '#bff6ff']],
    extrude: { dx: 0, dy: 12 * s, steps: 12, color: '#2a0a4d' },
    glow: { color: 'rgba(255,47,163,0.95)', blur: 34 * s },
  };
  const sunsetOpts = {
    font: K.font(400, 104 * s, 'Russo One'), skewX: 0.24, tracking: 0.16,
    fill: sunsetFill,
    outlines: [[14 * s, '#12052b'], [4 * s, '#fff1c7']],
    extrude: { dx: 0, dy: 8 * s, steps: 8, color: '#3d0a3f' },
    glow: { color: 'rgba(47,243,255,0.9)', blur: 26 * s },
  };
  const logo = K.makeCanvas(LOGO_W, LOGO_H);
  {
    const c = logo.getContext('2d');
    // speed swoosh under SUNSET: thin at the tail, fat in the middle, sharp tip on the right
    c.save();
    c.translate(LOGO_W / 2, 0);
    c.shadowColor = 'rgba(255,79,184,0.95)'; c.shadowBlur = 16 * s;
    c.beginPath();
    c.moveTo(-400 * s, 306 * s);
    c.quadraticCurveTo(10 * s, 286 * s, 500 * s, 266 * s);
    c.quadraticCurveTo(80 * s, 306 * s, -400 * s, 310 * s);
    c.closePath();
    c.fillStyle = K.linGrad(c, -400 * s, 0, 500 * s, 0, [[0, 'rgba(47,243,255,0)'], [0.3, '#2ff3ff'], [0.62, '#ffffff'], [0.88, '#ff7fd0'], [1, '#ff4fb8']]);
    c.fill();
    c.restore();
    K.logoText(c, 'SUNSET', LOGO_W / 2 + 60 * s, SUNSET_Y, sunsetOpts);
    K.logoText(c, 'NITRO', LOGO_W / 2 - 10 * s, NITRO_Y, nitroOpts);
  }
  // NITRO fill only: mask for the landing flash and the moving chrome shine
  const nitroMask = K.makeCanvas(LOGO_W, LOGO_H);
  K.logoText(nitroMask.getContext('2d'), 'NITRO', LOGO_W / 2 - 10 * s, NITRO_Y, { ...nitroOpts, outlines: [], extrude: null, glow: null, fill: '#fff' });
  const shine = K.makeCanvas(LOGO_W, LOGO_H), shc = shine.getContext('2d');

  // PRESS START
  const press = K.makeCanvas(560 * s, 80 * s);
  {
    const c = press.getContext('2d');
    c.font = K.font(600, 28 * s, 'Orbitron');
    c.textBaseline = 'middle';
    c.save(); c.shadowColor = 'rgba(47,243,255,1)'; c.shadowBlur = 16 * s; c.fillStyle = '#7ff8ff';
    K.spacedText(c, 'PRESS START', press.width / 2, press.height / 2, 0.28); c.restore();
    c.lineWidth = 5 * s; c.strokeStyle = '#12052b'; c.lineJoin = 'round';
    K.spacedText(c, 'PRESS START', press.width / 2, press.height / 2, 0.28, 'center', 'stroke');
    c.fillStyle = '#ffffff';
    K.spacedText(c, 'PRESS START', press.width / 2, press.height / 2, 0.28);
  }

  // ------------------------------------------------------------ the car (rear view, pre-rendered)
  const CS = 0.92 * s;                  // car drawing scale
  const CW = Math.ceil(560 * s), CH = Math.ceil(300 * s);
  const CAR_BASE = 272 * s;             // tyre contact line inside the car canvas
  const EXH = [-84, -56, 56, 84], EXH_Y = -34;
  const car = K.makeCanvas(CW, CH);
  {
    const c = car.getContext('2d');
    c.translate(CW / 2, CAR_BASE);
    c.scale(CS, CS);
    const poly = (pts, fill) => {
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = fill; c.fill();
    };
    // contact shadow
    c.fillStyle = K.radGrad(c, 0, 0, 0, 260, [[0, 'rgba(5,0,15,0.9)'], [0.75, 'rgba(5,0,15,0.55)'], [1, 'rgba(5,0,15,0)']]);
    c.save(); c.scale(1, 0.11); c.beginPath(); c.arc(0, 0, 260, 0, K.TAU); c.fill(); c.restore();
    // tyres seen from behind: rounded, circumferential grooves show as vertical lines
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -224 : 150;
      c.fillStyle = K.linGrad(c, x0, 0, x0 + 74, 0, [[0, '#050309'], [0.5, '#1c1727'], [1, '#050309']]);
      K.roundRect(c, x0, -66, 74, 68, 16); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.55)';
      for (let k = 0; k < 4; k++) c.fillRect(x0 + 13 + k * 15, -60, 3, 58);
      c.fillStyle = 'rgba(255,90,170,0.22)';
      c.fillRect(x0 + (sx < 0 ? 68 : 2), -58, 4, 54);
    }
    // diffuser between the tyres
    poly([[-156, -14], [156, -14], [168, -66], [-168, -66]], '#120a20');
    for (let k = -4; k <= 4; k++) poly([[k * 30 - 2, -14], [k * 30 + 2, -14], [k * 33 + 2, -56], [k * 33 - 2, -56]], '#2a1e3f');
    // exhaust tips
    for (const ex of EXH) {
      c.fillStyle = K.linGrad(c, 0, EXH_Y - 11, 0, EXH_Y + 11, [[0, '#9aa3c8'], [0.5, '#4d4c6e'], [1, '#221d33']]);
      c.beginPath(); c.ellipse(ex, EXH_Y, 13, 9, 0, 0, K.TAU); c.fill();
      c.fillStyle = '#05020c';
      c.beginPath(); c.ellipse(ex, EXH_Y, 9.5, 6, 0, 0, K.TAU); c.fill();
    }
    // main rear body: teal wedge with flared hips that cover the tyre tops
    poly([[-150, -58], [-228, -62], [-236, -96], [-226, -134], [-202, -160], [202, -160], [226, -134], [236, -96], [228, -62], [150, -58], [146, -66], [-146, -66]],
      K.linGrad(c, 0, -160, 0, -58, [[0, '#86f4ff'], [0.16, '#33c9de'], [0.55, '#0f7d9c'], [1, '#05344d']]));
    // hip highlights + body crease
    for (const sx of [-1, 1]) poly([[sx * 204, -156], [sx * 226, -132], [sx * 232, -100], [sx * 222, -104], [sx * 214, -132], [sx * 196, -152]], 'rgba(200,255,255,0.35)');
    poly([[-228, -74], [228, -74], [230, -80], [-230, -80]], 'rgba(2,20,36,0.55)');
    for (const sx of [-1, 1]) poly([[sx * 170, -80], [sx * 220, -80], [sx * 226, -100], [sx * 188, -96]], '#06192a');
    // taillights: two slanted blades each side
    for (const sx of [-1, 1]) {
      poly([[sx * 58, -134], [sx * 214, -144], [sx * 216, -128], [sx * 62, -122]], '#2a0612');
      poly([[sx * 64, -131], [sx * 208, -140], [sx * 209, -134], [sx * 66, -127]], '#ff2a55');
      poly([[sx * 64, -131], [sx * 208, -140], [sx * 208, -138], [sx * 65, -129.5]], '#ffd0dc');
      poly([[sx * 124, -125], [sx * 210, -129.5], [sx * 210, -126], [sx * 126, -122]], '#ff2a55');
    }
    // centre panel, chevron badge, plate
    poly([[-54, -130], [54, -130], [50, -104], [-50, -104]], '#0a0616');
    poly([[-14, -124], [0, -114], [14, -124], [14, -119], [0, -109], [-14, -119]], '#e9f6ff');
    c.fillStyle = '#d8e2ff';
    K.roundRect(c, -42, -98, 84, 22, 3); c.fill();
    c.fillStyle = '#1b1435'; c.font = K.font(700, 16, 'Chakra Petch'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N1TR0', 0, -86.5);
    // rear deck seen from above (sky reflection)
    poly([[-202, -160], [202, -160], [180, -178], [-180, -178]], K.linGrad(c, 0, -178, 0, -160, [[0, '#ffb36b'], [0.5, '#ff7aa0'], [1, '#c43d8e']]));
    for (const sx of [-1, 1]) poly([[sx * 96, -162], [sx * 152, -162], [sx * 142, -175], [sx * 100, -175]], '#3a1240');
    // cabin + rear glass
    poly([[-152, -178], [152, -178], [106, -240], [-106, -240]], '#0b4a63');
    poly([[-134, -182], [134, -182], [98, -232], [-98, -232]], K.linGrad(c, 0, -232, 0, -182, [[0, '#2a1450'], [0.55, '#140a2e'], [1, '#090418']]));
    poly([[-62, -182], [-32, -182], [24, -232], [-6, -232]], 'rgba(255,140,190,0.24)');
    poly([[-18, -182], [-8, -182], [46, -232], [36, -232]], 'rgba(255,200,150,0.18)');
    poly([[-106, -240], [106, -240], [102, -244], [-102, -244]], '#b6fbff');
    for (const sx of [-1, 1]) poly([[sx * 152, -200], [sx * 190, -204], [sx * 188, -190], [sx * 152, -188]], '#0f7d9c');
    // rear wing on struts
    for (const sx of [-1, 1]) poly([[sx * 84, -178], [sx * 96, -178], [sx * 92, -204], [sx * 82, -204]], '#0a0616');
    poly([[-236, -218], [236, -218], [232, -202], [-232, -202]], K.linGrad(c, 0, -218, 0, -202, [[0, '#ff9ccf'], [0.25, '#2fc6dc'], [1, '#063a55']]));
    poly([[-236, -218], [236, -218], [235, -215], [-235, -215]], '#ffe0f0');
    for (const sx of [-1, 1]) poly([[sx * 226, -230], [sx * 240, -230], [sx * 240, -190], [sx * 226, -194]], '#08374f');
    // rim light along the shoulders
    c.strokeStyle = 'rgba(190,255,255,0.9)'; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-226, -134); c.lineTo(-202, -160); c.lineTo(202, -160); c.lineTo(226, -134); c.stroke();
  }
  // taillight bloom, red road reflection, cyan underglow (pre-blurred)
  const tailGlow = K.makeCanvas(CW, CH);
  {
    const c = tailGlow.getContext('2d');
    c.translate(CW / 2, CAR_BASE);
    c.scale(CS, CS);
    c.filter = `blur(${10 * CS}px)`;
    c.fillStyle = 'rgba(255,40,90,0.9)';
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(sx * 64, -131); c.lineTo(sx * 208, -140); c.lineTo(sx * 209, -127); c.lineTo(sx * 66, -122); c.closePath(); c.fill();
    }
    c.filter = `blur(${18 * CS}px)`;
    c.fillStyle = 'rgba(255,40,90,0.4)';
    c.fillRect(-200, 4, 400, 16);
    c.fillStyle = 'rgba(47,243,255,0.45)';
    c.fillRect(-160, -12, 320, 12);
  }
  // nitro bursts: blue-white flames blowing back toward the camera (4 frames, drawn additively)
  const FL = Math.ceil(110 * CS);
  const flames = [0, 1, 2, 3].map((f) => {
    const c0 = K.makeCanvas(FL, FL), c = c0.getContext('2d');
    const r = K.rng(31 + f * 7);
    c.translate(FL / 2, FL / 2);
    c.scale(CS, CS);
    c.fillStyle = K.radGrad(c, 0, 6, 0, 48, [[0, 'rgba(120,200,255,0.7)'], [0.45, 'rgba(70,90,255,0.28)'], [1, 'rgba(60,60,255,0)']]);
    c.fillRect(-55, -55, 110, 110);
    c.filter = `blur(${2 * CS}px)`;
    for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 + (r() - 0.5) * 2.0, len = 18 + r() * 30, wd = 2.5 + r() * 3.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      c.fillStyle = k % 3 === 0 ? 'rgba(220,250,255,0.85)' : k % 3 === 1 ? 'rgba(110,230,255,0.75)' : 'rgba(90,110,255,0.7)';
      c.beginPath();
      c.moveTo(-sa * wd, ca * wd);
      c.quadraticCurveTo(ca * len * 0.5 - sa * wd, sa * len * 0.5 + ca * wd, ca * len, sa * len * 0.8);
      c.quadraticCurveTo(ca * len * 0.5 + sa * wd, sa * len * 0.5 - ca * wd, sa * wd, -ca * wd);
      c.closePath(); c.fill();
    }
    c.filter = 'none';
    c.fillStyle = K.radGrad(c, 0, 2, 0, 14, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(200,250,255,0.75)'], [1, 'rgba(160,230,255,0)']]);
    c.beginPath(); c.ellipse(0, 3, 16, 12, 0, 0, K.TAU); c.fill();
    return c0;
  });
  // glowing tops of the roadside posts (cyan left, pink right)
  const postGlow = [[47, 243, 255], [255, 79, 184]].map(([R, G, B]) => {
    const c0 = K.makeCanvas(64, 64), c = c0.getContext('2d');
    c.fillStyle = K.radGrad(c, 32, 32, 0, 32, [[0, 'rgba(255,255,255,1)'], [0.18, `rgba(${R},${G},${B},0.95)`], [0.5, `rgba(${R},${G},${B},0.3)`], [1, `rgba(${R},${G},${B},0)`]]);
    c.fillRect(0, 0, 64, 64);
    return c0;
  });
  // speed streak sprite: tapered, bright at the outer end
  const streak = K.makeCanvas(256, 8);
  {
    const c = streak.getContext('2d');
    c.fillStyle = K.linGrad(c, 0, 0, 256, 0, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0.95)']]);
    c.beginPath(); c.moveTo(0, 4); c.lineTo(256, 0); c.lineTo(256, 8); c.closePath(); c.fill();
  }
  [logo, nitroMask, press, car, tailGlow, streak, ...flames, ...postGlow].forEach(flush);

  // ------------------------------------------------------------ moving road helpers
  const addQuad = (ctx, x0, x1, z0, z1) => {
    const [ax, ay] = P(x0, z0), [bx] = P(x1, z0), [cx, cy] = P(x1, z1), [dx] = P(x0, z1);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(cx, cy); ctx.lineTo(dx, cy); ctx.closePath();
  };
  const fillQuad = (ctx, x0, x1, z0, z1) => { ctx.beginPath(); addQuad(ctx, x0, x1, z0, z1); ctx.fill(); };

  return {
    bg(ctx) {
      ctx.save();
      // sky
      ctx.fillStyle = K.linGrad(ctx, 0, 0, 0, HY, [[0, '#0d0426'], [0.3, '#2c0b52'], [0.55, '#6d1475'], [0.78, '#cf2f78'], [0.92, '#ff6a52'], [1, '#ffa14a']]);
      ctx.fillRect(0, 0, w, HY + 2);
      K.stars(ctx, w, HY * 0.55, { n: 140, seed: 21, maxR: 1.8 * s, color: '255,235,255' });
      // sun glow + sun with cut stripes
      const SR = 158 * s, SY = HY + 6 * s;
      ctx.fillStyle = K.radGrad(ctx, VX, SY - SR * 0.45, 0, SR * 2.6, [[0, 'rgba(255,190,90,0.55)'], [0.35, 'rgba(255,80,120,0.28)'], [1, 'rgba(255,60,140,0)']]);
      ctx.fillRect(0, 0, w, HY);
      const sun = K.makeCanvas(SR * 2 + 4, SR + 4), sc = sun.getContext('2d');
      sc.fillStyle = K.linGrad(sc, 0, 0, 0, SR, [[0, '#fff7b0'], [0.3, '#ffd45c'], [0.62, '#ff8a3d'], [1, '#ff3a78']]);
      sc.beginPath(); sc.arc(SR + 2, SR + 2, SR, Math.PI, 0); sc.closePath(); sc.fill();
      sc.globalCompositeOperation = 'destination-out';
      let y = SR * 0.42;
      for (let i = 0; i < 8; i++) { const th = (2 + i * 2.6) * s; sc.fillRect(0, y, SR * 2 + 4, th); y += th + (14 - i * 1.1) * s; }
      ctx.drawImage(sun, VX - SR - 2, SY - SR - 2);
      // soft cloud streaks
      for (const [cx, cy, cw, ch, a] of [[300, 292, 520, 7, 0.5], [990, 312, 560, 6, 0.5], [180, 228, 320, 4, 0.35], [1120, 250, 300, 4, 0.35]]) {
        ctx.fillStyle = K.linGrad(ctx, (cx - cw / 2) * s, 0, (cx + cw / 2) * s, 0, [[0, 'rgba(70,14,90,0)'], [0.3, `rgba(70,14,90,${a})`], [0.7, `rgba(70,14,90,${a})`], [1, 'rgba(70,14,90,0)']]);
        K.roundRect(ctx, (cx - cw / 2) * s, cy * s, cw * s, ch * s, ch * s * 0.5); ctx.fill();
      }
      // far (hazy) and near (dark, rim-lit) mountains with a valley for the road
      const range = (seed, amp, lo, col, rim) => {
        const r = K.rng(seed), pts = [];
        for (let x = -20; x <= 1300; x += 26 + r() * 30) {
          const d = Math.abs(x - 640) / 640;
          const hh = (lo + amp * K.smooth(0.08, 0.95, d)) * (0.55 + r() * 0.45);
          pts.push([x * s, HY - hh * s]);
        }
        ctx.beginPath(); ctx.moveTo(-20 * s, HY + 2); pts.forEach(([x, yy]) => ctx.lineTo(x, yy)); ctx.lineTo(1300 * s, HY + 2); ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 2 * s; ctx.beginPath();
        pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.stroke();
      };
      range(5, 150, 20, K.linGrad(ctx, 0, HY - 170 * s, 0, HY, [[0, '#7a2a86'], [1, '#c2457f']]), 'rgba(255,170,200,0.35)');
      range(9, 120, 6, K.linGrad(ctx, 0, HY - 130 * s, 0, HY, [[0, '#2a0b45'], [1, '#43125a']]), 'rgba(255,90,170,0.8)');
      // horizon haze
      ctx.fillStyle = K.linGrad(ctx, 0, HY - 30 * s, 0, HY + 30 * s, [[0, 'rgba(255,120,140,0)'], [0.5, 'rgba(255,130,150,0.55)'], [1, 'rgba(255,120,140,0)']]);
      ctx.fillRect(0, HY - 30 * s, w, 60 * s);
      // ground + converging grid rails
      ctx.fillStyle = K.linGrad(ctx, 0, HY, 0, h, [[0, '#3a0f4f'], [0.25, '#1d0833'], [1, '#0c0318']]);
      ctx.fillRect(0, HY, w, h - HY);
      ctx.strokeStyle = 'rgba(255,60,200,0.5)'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        for (const sx of [-1, 1]) {
          const x = sx * (ROAD + 0.9 + k * 1.6);
          const [x0, y0] = P(x, 60), [x1, y1] = P(x, Z_BOT);
          ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        }
      }
      ctx.stroke();
      // road surface, sun reflection, neon edges
      ctx.fillStyle = K.linGrad(ctx, 0, HY, 0, h, [[0, '#4a2a5e'], [0.12, '#26173a'], [1, '#150c22']]);
      fillQuad(ctx, -ROAD - 0.3, ROAD + 0.3, 200, Z_BOT);
      ctx.fillStyle = K.linGrad(ctx, 0, HY, 0, h, [[0, 'rgba(255,150,90,0.45)'], [0.5, 'rgba(255,90,130,0.12)'], [1, 'rgba(255,90,130,0)']]);
      fillQuad(ctx, -0.9, 0.9, 200, Z_BOT);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = sx < 0 ? '#2ff3ff' : '#ff4fb8';
        fillQuad(ctx, sx * (ROAD - 0.08), sx * (ROAD - 0.2), 200, Z_BOT);
      }
      K.vignette(ctx, w, h, 0.4, '8,0,24');
      ctx.restore();
    },
    fg(ctx, t) {
      ctx.save();
      const travel = t * SPEED;
      // horizontal grid lines scroll toward the viewer (only beside the road)
      const g0 = 2.4;
      ctx.fillStyle = 'rgb(255,60,200)';
      for (let k = 0; k < 18; k++) {
        const z = Z_BOT + ((k * g0 - travel) % (18 * g0) + 18 * g0) % (18 * g0);
        const y = HY + F / z, half = (ROAD + 0.3) * (y - HY);
        ctx.globalAlpha = 0.6 * K.clamp(1 - (z - 8) / 34);
        const th = Math.max(1, (3 * s) / Math.sqrt(z));
        ctx.fillRect(0, y - th / 2, VX - half, th);
        ctx.fillRect(VX + half, y - th / 2, w - VX - half, th);
      }
      ctx.globalAlpha = 1;
      // rumble strips + lane dashes (batched into one path per colour)
      const period = 3.0, dash = 1.4, n = 14;
      const white = new Path2D(), red = new Path2D(), lanes = new Path2D();
      for (let k = 0; k < n; k++) {
        const z0 = Z_BOT + ((k * period - travel) % (n * period) + n * period) % (n * period);
        for (const lx of [-LANE / 2, LANE / 2]) addQuad(lanes, lx - 0.065, lx + 0.065, z0, z0 + dash);
        for (const sx of [-1, 1]) {
          addQuad(red, sx * ROAD, sx * (ROAD + 0.3), z0, z0 + period / 2);
          addQuad(white, sx * ROAD, sx * (ROAD + 0.3), z0 + period / 2, z0 + period);
        }
      }
      ctx.fillStyle = '#ff3a5c'; ctx.fill(red);
      ctx.fillStyle = '#f4ecff'; ctx.fill(white);
      ctx.fillStyle = 'rgba(226,214,255,0.8)'; ctx.fill(lanes);

      // neon roadside posts rushing past
      const pp = 7.0, np = 9;
      for (let k = np - 1; k >= 0; k--) {
        const z = 2.0 + ((k * pp - travel) % (np * pp) + np * pp) % (np * pp);
        const fade = K.clamp(1 - (z - 20) / 40);
        if (fade <= 0) continue;
        for (const sx of [-1, 1]) {
          const X = sx * (ROAD + 1.0);
          const [px, gy] = P(X, z), top = HY - (F * 0.5) / z, pw = Math.max(1, (F * 0.07) / z);
          ctx.globalAlpha = fade;
          ctx.fillStyle = '#12061f';
          ctx.fillRect(px - pw / 2, top, pw, gy - top);
          ctx.fillStyle = sx < 0 ? '#2ff3ff' : '#ff4fb8';
          ctx.fillRect(px - pw / 2, top, pw, Math.max(1, (F * 0.06) / z));
          const gs = (F * 0.5) / z;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(postGlow[sx < 0 ? 0 : 1], px - gs / 2, top - gs / 2, gs, gs);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;

      // speed streaks toward the screen edges
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const a = (K.hash(i, 3) - 0.42) * 0.62;          // around horizontal, mostly below
        const ph = (t * (0.9 + K.hash(i, 5) * 0.7) + K.hash(i, 7)) % 1;
        const r0 = (330 + ph * 520) * s, len = (90 + ph * 240) * s;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
        // map the 256x8 sprite onto a ray from the vanishing point: x along the ray, y across it
        const ca = Math.cos(a), sa = Math.sin(a), th = ((1 + ph * 1.5) * s) / 2;
        ctx.save();
        ctx.transform((side * ca * len) / 256, (sa * len) / 256, -sa * th, side * ca * th, VX + side * ca * r0, HY + sa * r0);
        ctx.drawImage(streak, 0, -4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // the car: high-frequency rumble + slow drift
      const cx = VX + Math.sin(t * 0.9) * 10 * s;
      const cy = 654 * s + Math.round(Math.sin(t * 47) * 1.2 * s);
      ctx.drawImage(car, cx - CW / 2, cy - CAR_BASE);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 9);
      ctx.drawImage(tailGlow, cx - CW / 2, cy - CAR_BASE);
      const ff = Math.floor(t * 18);
      EXH.forEach((ex, i) => {
        const burst = 0.55 + 0.45 * K.hash(ff, i);
        ctx.globalAlpha = burst;
        const fr = flames[(ff + i) % 4], sz = FL * (0.75 + 0.35 * burst);
        ctx.drawImage(fr, cx + ex * CS - sz / 2, cy + EXH_Y * CS - sz / 2 + 6 * CS, sz, sz);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // logo streaks in from the left and locks
      const lx = VX - LOGO_W / 2, ly = 26 * s;
      const a1 = K.easeOutCubic((t - 0.16) / 0.34);
      if (a1 > 0) {
        const off = (1 - a1) * -900 * s;
        for (let k = 2; k >= 0; k--) { // motion-blur ghosts trail the slide
          if (k && a1 > 0.98) continue;
          ctx.globalAlpha = k ? 0.22 * (1 - a1) : 1;
          ctx.drawImage(logo, lx + off - k * 80 * s * (1 - a1), ly);
        }
        ctx.globalAlpha = 1;
      }
      // landing flash + periodic chrome shine
      const land = 0.5;
      if (t > land && t < land + 0.25) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7 * (1 - (t - land) / 0.25);
        ctx.drawImage(nitroMask, lx, ly);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      const sp = ((t - 0.75) % 2.8) / 0.9;
      if (t > 0.75 && sp < 1) {
        // only the columns under the moving band are composited
        const bx = (-0.2 + sp * 1.4) * LOGO_W;
        const x0 = Math.max(0, Math.floor(bx - 92 * s)), x1 = Math.min(LOGO_W, Math.ceil(bx + 92 * s));
        if (x1 > x0) {
          shc.globalCompositeOperation = 'source-over';
          shc.clearRect(x0, 0, x1 - x0, LOGO_H);
          shc.drawImage(nitroMask, x0, 0, x1 - x0, LOGO_H, x0, 0, x1 - x0, LOGO_H);
          shc.globalCompositeOperation = 'source-in';
          shc.fillStyle = K.linGrad(shc, bx - 90 * s, 0, bx + 90 * s, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
          shc.fillRect(x0, 0, x1 - x0, LOGO_H);
          ctx.drawImage(shine, x0, 0, x1 - x0, LOGO_H, lx + x0, ly, x1 - x0, LOGO_H);
        }
      }

      // PRESS START
      const ui = K.easeOutCubic((t - 0.7) / 0.35);
      if (ui > 0 && (t < 1.2 || K.blinkOn(t, 1.4, 0.68))) {
        ctx.globalAlpha = ui;
        ctx.drawImage(press, VX - press.width / 2, 696 * s - press.height / 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  };
}
