// Small math helpers shared by the page modules (pure; also importable from Node).
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t) => Math.pow(clamp(t), 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - clamp(t), 5);
export const easeInQuad = (t) => clamp(t) * clamp(t);
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const easeOutExpo = (t) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInExpo = (t) => (clamp(t) <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10));
export const easeOutBack = (t, k = 1.70158) => { t = clamp(t); const c3 = k + 1; return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2); };
/** 0 -> 1 -> 0 pulse over [a, b] peaking at the given fraction. */
export const pulse = (a, b, x, peak = 0.5) => {
  if (x <= a || x >= b) return 0;
  const u = (x - a) / (b - a);
  return u < peak ? smoothstep(0, peak, u) : 1 - smoothstep(peak, 1, u);
};

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(i, j = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 2D value noise + fbm (deterministic) for terrain and islands.
function vhash(x, y) { return hash(x * 7919 + 13, y * 104729 + 7); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = vhash(xi, yi), b = vhash(xi + 1, yi), c = vhash(xi, yi + 1), d = vhash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
