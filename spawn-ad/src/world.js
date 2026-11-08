// The game world: a ride down the street of a fantasy quest-hub village at golden hour, in the manner of a
// modern MMORPG. Real CC0 assets (src/assets.js, fetched by tools/fetch-assets.mjs): a Poly Haven sunset sky
// as the background (a sharp 16k window round the view) and as image-based light, Poly Haven PBR scans on
// every surface (cobbled road, plaster, timber, stone, clay/slate/thatch roofs, grass), a few Poly Haven props
// near the road (barrels, crates, a bucket, shields) and ambientCG leaf scans in the tree canopies.
// Villagers, quest markers, lanterns, stalls, bunting and the buildings are modelled here (src/village.js).
// The layout along the road: the town gate, a street of half-timbered houses, a stone bridge over a stream,
// the market square with its stalls and well on the left and the inn and smithy on the right, more houses and
// a bell tower, then fields and the castle on its hill at the end of the road.
//
// Performance notes (SwiftShader, no GPU): every rasterized fragment is shaded, so what counts is screen
// area x shader cost. Haze and foliage lighting are per vertex, shadows use a cheap 4-tap filter on one static
// shadow map, grass blades exist only near the ride, the sky is drawn last so only open sky is shaded.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, smoothstep, rng, fbm, hash, TAU } from './util.js';
import { trailX, cameraBase, cameraPose } from './ride.js';
import { loadAssets } from './assets.js';
import { makeTextures } from './textures.js';
import {
  Batch, TILE, M, PALETTE, cottage, gate, bridgeParapets, lampPost, fence, sack, stall, well, cart, bannerPole, woodpile,
  bench, haybale, anvil, bellTower, broadleaf, bush, box, cyl, paint, barrel, crate, lantern, bunting, villager, questMark,
  signpost,
} from './village.js';
export { trailX };

const C = (hex) => new THREE.Color(hex); // sRGB hex -> linear working colour
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------- the plan
// Everything along the road is placed by these, so terrain, buildings, props and grass agree.
const GATE_Z = 0.5; // the gatehouse straddles the road here (passed before the first title screen lands)
const STREAM = { z: -24, half: 3.0, depth: 1.45 }; // the stream crosses under the bridge at z, half width at the road
const XR = trailX(STREAM.z);
/** The stream's centre line: crosses the road square to it under the bridge, meanders away from it. */
const streamZ = (x) => STREAM.z + 1.5 * Math.sin((x - XR) * 0.07) + 0.7 * Math.sin((x - XR) * 0.19) * smoothstep(4, 14, Math.abs(x - XR));
const SQUARE = { z0: -56, z1: -34, x0: -21, x1: -2.4 }; // the market square, left of the road (x relative to it)
const POND = { x: XR - 11.5, z: -24.6, r: 5.6 }; // where the stream widens beside the bridge (seen from the road)
const pondD = (x, z) => Math.hypot((x - POND.x) * 0.8, z - POND.z) - POND.r;
const CASTLE = { x: 44, z: -470 };
const SUN = { az: -20, el: 12 }; // the sun light (the sky's sun glow is at the same azimuth, a little lower)
const LIGHT = { sun: 5.6, sky: 1.3, warm: [1.14, 1.0, 0.82] }; // sun intensity; sky light gain and warmth (IBL and SH)

// ---------------------------------------------------------------------------------------- shared shading
// Materials end with the same display curve the sky was baked with (linear, soft shoulder from 0.75), then
// the haze: aerial perspective integrated along the view ray, coloured like the sky right behind the point
// (a table of the horizon's colours baked from the HDRI), so distant things dissolve into the sky.
const CURVE = /* glsl */ `
vec3 displayCurve(vec3 x) {
  x = max(x, 0.0);
  vec3 e = 0.75 + 0.25 * (1.0 - exp(-(x - 0.75) * 4.0));
  return mix(x, e, step(0.75, x));
}`;
const HAZE_U = {
  uHazeTex: { value: null },
  uHazeMap: { value: new THREE.Vector4() }, // az0, az1, el0, el1 (radians) of the table
  uHazeK: { value: new THREE.Vector3(0.0024, 1 / 55, 0.97) }, // density at y=0, height falloff, max amount
  uExposure: { value: 1 },
};
const HAZE_COMMON = /* glsl */ `
uniform sampler2D uHazeTex;
uniform vec4 uHazeMap;
uniform vec3 uHazeK;
vec3 hazeColor(vec3 V) {
  float az = atan(V.x, -V.z);
  float el = asin(clamp(V.y, -1.0, 1.0));
  vec2 uv = vec2((az - uHazeMap.x) / (uHazeMap.y - uHazeMap.x), (el - uHazeMap.z) / (uHazeMap.w - uHazeMap.z));
  return texture2D(uHazeTex, clamp(uv, vec2(0.01), vec2(0.99))).rgb;
}
vec4 hazeAt(vec3 wp) {
  vec3 rd = wp - cameraPosition;
  float dist = length(rd);
  rd /= max(dist, 1e-4);
  float b = uHazeK.y;
  float t = dist * rd.y * b;
  float od = uHazeK.x * exp(-cameraPosition.y * b) * dist * (abs(t) > 1e-4 ? (1.0 - exp(-t)) / t : 1.0);
  return vec4(hazeColor(rd), (1.0 - exp(-od)) * uHazeK.z);
}
`;
const HAZE_VERT = /* glsl */ `
vec4 hzW = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  hzW = instanceMatrix * hzW;
#endif
hzW = modelMatrix * hzW;
// @wind
vHazeW = hzW.xyz;
vHaze = hazeAt(hzW.xyz);
vec4 mvPosition = viewMatrix * hzW;
gl_Position = projectionMatrix * mvPosition;
`;

// Cheaper soft shadows than the renderer's 16-tap PCFSoft: 4 taps on a 1.5-texel grid, blended bilinearly.
const CHEAP_PCF = /* glsl */ `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
      vec2 cell = shadowMapSize / 1.5;
      vec2 g = shadowCoord.xy * cell - 0.5;
      vec2 f = fract(g);
      vec2 b = (floor(g) + 0.5) / cell;
      vec2 o = 1.0 / cell;
      shadow = mix(
        mix(texture2DCompare(shadowMap, b, shadowCoord.z), texture2DCompare(shadowMap, b + vec2(o.x, 0.0), shadowCoord.z), f.x),
        mix(texture2DCompare(shadowMap, b + vec2(0.0, o.y), shadowCoord.z), texture2DCompare(shadowMap, b + o, shadowCoord.z), f.x), f.y);
    #elif defined( SHADOWMAP_TYPE_VSM )`;
const SHADOW_PARS = THREE.ShaderChunk.shadowmap_pars_fragment.replace(/#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \)[\s\S]*?#elif defined\( SHADOWMAP_TYPE_VSM \)/, CHEAP_PCF);

// Sky light from the HDRI as spherical harmonics (world space, baked by tools/fetch-assets.mjs): irradiance for
// a normal in a few multiply-adds. Under SwiftShader the PMREM cube lookups of three's image-based light cost
// about 0.9 s a frame over the whole village, so rough surfaces (nearly everything) take their diffuse and their
// (very blurred) specular sky light from this instead; glossy ones (water, metal, the glTF props, the rider)
// keep the PMREM of the same HDR.
const SH_GLSL = /* glsl */ `
uniform vec3 uSH[9];
vec3 skyIrradiance(vec3 n) {
  return uSH[0] * 0.282095
    + uSH[1] * (0.488603 * n.y) + uSH[2] * (0.488603 * n.z) + uSH[3] * (0.488603 * n.x)
    + uSH[4] * (1.092548 * n.x * n.y) + uSH[5] * (1.092548 * n.y * n.z) + uSH[6] * (0.315392 * (3.0 * n.z * n.z - 1.0))
    + uSH[7] * (1.092548 * n.x * n.z) + uSH[8] * (0.546274 * (n.x * n.x - n.y * n.y));
}`;
const SH_IBL = /* glsl */ `
#ifdef USE_ENVMAP
${SH_GLSL}
vec3 getIBLIrradiance( const in vec3 normal ) {
  return max(skyIrradiance(inverseTransformDirection(normal, viewMatrix)), 0.0);
}
vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
  vec3 r = reflect(-viewDir, normal);
  r = normalize(mix(r, normal, roughness * roughness));
  return max(skyIrradiance(inverseTransformDirection(r, viewMatrix)), 0.0) * RECIPROCAL_PI;
}
#endif
`;
const SH_U = { uSH: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) } };

/**
 * Give a built-in material the shared haze, display curve and cheaper shadow filter, plus optional extra shader
 * edits. ibl: 'sh' (sky light from the harmonics) or 'pmrem' (three's image-based light, for glossy things).
 * Materials without extra edits share one cache key, so three reuses compiled programs between materials with
 * the same features (compiling is slow under SwiftShader).
 */
function haze(mat, key, extra, ibl = 'sh') {
  if (!extra) key = 'common';
  mat.fog = false;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, HAZE_U, SH_U);
    if (ibl === 'sh') sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', SH_IBL);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHazeW; varying vec4 vHaze;\n' + HAZE_COMMON)
      .replace('#include <project_vertex>', HAZE_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHazeW; varying vec4 vHaze;\nuniform float uExposure;\n' + CURVE)
      .replace('#include <shadowmap_pars_fragment>', SHADOW_PARS)
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = displayCurve(gl_FragColor.rgb * uExposure);')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vHaze.rgb, vHaze.a);');
    if (extra) extra(sh);
  };
  mat.customProgramCacheKey = () => 'haze:' + ibl + ':' + key;
  return mat;
}

// ---------------------------------------------------------------------------------------- foliage
// Grass, flowers and leaves: diffuse light from the sky (spherical harmonics of the HDRI) and the sun, light
// through the blades when backlit, a 4-tap shadow and the haze, all per vertex (blades are thin and leaf cards
// overlap a lot, so the fragment shader must be nearly free).
const FOLIAGE_VERT = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_vertex>
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
#endif
uniform float uT, uWind, uTipH;
uniform vec2 uTrans, uFade, uCellScale;
uniform float uSkyK;
#ifdef USE_CELL
attribute vec2 aCell;
#endif
varying vec3 vLight, vCol;
varying vec2 vUv;
varying vec4 vHaze;
varying float vFade;
#ifdef EDGE_FADE
varying vec3 vViewPos;
#endif
${HAZE_COMMON}
${SH_GLSL}
float shadowAt(vec4 sc, vec2 size, float bias) {
  sc.xyz /= sc.w;
  sc.z += bias;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  vec2 o = 1.2 / size;
  float s = step(sc.z, unpackRGBAToDepth(texture2D(directionalShadowMap[0], sc.xy + vec2(-o.x, -o.y))))
          + step(sc.z, unpackRGBAToDepth(texture2D(directionalShadowMap[0], sc.xy + vec2(o.x, -o.y))))
          + step(sc.z, unpackRGBAToDepth(texture2D(directionalShadowMap[0], sc.xy + vec2(-o.x, o.y))))
          + step(sc.z, unpackRGBAToDepth(texture2D(directionalShadowMap[0], sc.xy + vec2(o.x, o.y))));
  return s * 0.25;
  #else
  return 1.0;
  #endif
}
void main() {
  vec4 wp = vec4(position, 1.0);
  vec3 objN = normal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  objN = mat3(instanceMatrix) * objN;
  #endif
  wp = modelMatrix * wp;
  float hh = max(position.y, 0.0);
  #ifdef WIND_GRASS
  {
    float ph = dot(wp.xz, vec2(0.21, 0.16));
    float gust = sin(uT * 1.1 + ph) * 0.5 + sin(uT * 2.3 + ph * 2.7) * 0.22 + sin(uT * 0.37 + wp.x * 0.05) * 0.3 + 0.2;
    wp.xz += vec2(0.85, 0.5) * gust * hh * hh * uWind;
    wp.y -= abs(gust) * hh * hh * uWind * 0.18;
  }
  #endif
  #ifdef WIND_LEAVES
  {
    float ph = dot(wp.xyz, vec3(0.31, 0.17, 0.23));
    wp.xyz += vec3(0.05, 0.03, 0.04) * sin(uT * 1.3 + ph) * (0.5 + 0.5 * sin(uT * 0.4 + wp.x * 0.05)) * uWind;
  }
  #endif
  vec3 wn = normalize(mat3(modelMatrix) * objN);
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  #ifdef EDGE_FADE
  vViewPos = mv.xyz;
  #endif
  float sh = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  sh = shadowAt(directionalShadowMatrix[0] * vec4(wp.xyz + wn * directionalLightShadows[0].shadowNormalBias, 1.0),
                directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias);
  #endif
  vec3 sun = vec3(0.0), L = vec3(0.0, 1.0, 0.0);
  #if NUM_DIR_LIGHTS > 0
  sun = directionalLights[0].color * sh;
  L = normalize((vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz); // view -> world (rotation only)
  #endif
  vec3 irr = sun * max(dot(wn, L), 0.0) + skyIrradiance(wn) * uSkyK;
  vec3 V = normalize(wp.xyz - cameraPosition);
  float back = max(dot(V, L), 0.0);
  back = back * back * back;
  #ifdef WIND_LEAVES
  float tip = 1.0;
  #else
  float tip = clamp(hh / uTipH, 0.0, 1.0);
  #endif
  vLight = irr * RECIPROCAL_PI + sun * (back * uTrans.x + uTrans.y) * tip;
  vCol = vec3(1.0);
  #ifdef USE_COLOR
  vCol *= color;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
  #endif
  #ifdef USE_CELL
  vUv = vec2(uv.x, 1.0 - uv.y) * uCellScale + aCell;
  #else
  vUv = uv;
  #endif
  vFade = smoothstep(uFade.x, uFade.y, length(wp.xyz - cameraPosition));
  vHaze = hazeAt(wp.xyz);
}
`;
const FOLIAGE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uExposure;
varying vec3 vLight, vCol;
varying vec2 vUv;
varying vec4 vHaze;
varying float vFade;
#ifdef EDGE_FADE
varying vec3 vViewPos;
#endif
${CURVE}
void main() {
  vec4 c = vec4(vCol, 1.0);
  #ifdef USE_CARD
  c *= texture2D(uMap, vUv);
  #ifdef CARD_FADE
  c.a *= vFade;
  #endif
  #ifdef EDGE_FADE
  // leaf cards seen edge-on smear into streaks: thin them out as they turn away
  vec3 gN = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  c.a *= smoothstep(0.12, 0.42, abs(dot(gN, normalize(vViewPos))));
  #endif
  c.a = smoothstep(0.5, 0.5 + fwidth(c.a), c.a);
  if (c.a <= 0.0) discard;
  #endif
  vec3 col = displayCurve(c.rgb * vLight * uExposure);
  gl_FragColor = vec4(mix(col, vHaze.rgb, vHaze.a), c.a);
}
`;

export class World {
  constructor(W, H) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, W / H, 0.25, 6000);
    this.t = 0;
    this.renderH = H;
    this.timeU = { value: 0 };
    this.shU = SH_U.uSH;
  }

  /** Load the assets and build the world (main.js awaits this before the first frame). */
  async init() {
    const A = await loadAssets();
    this.A = A;
    this.skyMeta = A.sky.meta;
    this.tex = makeTextures(A.leaves);
    for (const [k, s] of Object.entries(A.sets)) TILE[k] = s.size;
    this.setupSkyLight();
    this.mats = this.makeMaterials();
    this.buildSky();
    this.buildSun();
    this.buildTerrain();
    this.buildWater();
    this.buildFar();
    this.buildVillage();
    this.buildModels();
    this.buildTrees();
    this.buildGrass();
    this.buildSmoke();
    this.buildGlows();
    this.buildMotes();
  }

  // ------------------------------------------------------------------ camera
  /** The camera's base pose (the ride decides it: third person behind the rider; see ride.js). */
  basePose(t) {
    return cameraBase(t);
  }

  /** Camera pose at time t: the smooth follow, plus the lunge into the vortex at the end. */
  camPose(t) {
    return cameraPose(t);
  }

  /** Ground height. The road (|x - trailX(z)| < 2.5) is always at 0; the bridge carries it over the stream. */
  groundAt(x, z) {
    const a = Math.abs(x - trailX(z));
    let h = smoothstep(2.7, 3.6, a) * 0.06;
    // the road and its verges stay level all the way out of the village (beyond, it may climb the hills)
    const level = (1 - smoothstep(2.6, 7, a)) * smoothstep(-170, -125, z);
    h += fbm(x * 0.05, z * 0.05, 3) * 0.45 * smoothstep(3.5, 11, a);
    // meadows rise away from the village, then rolling hills
    h += smoothstep(18, 80, a) * 3.5;
    const r = Math.hypot(x, z + 30);
    h += Math.max(0, fbm(x * 0.0075 + 3, z * 0.0075 - 2, 4) + 0.18) * 48 * smoothstep(70, 260, r);
    // the castle's hill
    h += 46 * Math.exp(-((x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2) / (115 * 115));
    // mountains far off, lower towards the sun so its glow reaches the horizon
    const d = Math.hypot(x * 0.8, z + 30);
    if (d > 600) {
      const rid = 1 - Math.abs(fbm(x * 0.0016 + 7, z * 0.0016 + 1, 5));
      const az = Math.atan2(x, -(z + 40)) / DEG;
      const low = 1 - 0.8 * Math.exp(-(((az - SUN.az) / 16) ** 2));
      h += smoothstep(650, 1500, d) * (Math.pow(rid, 2.4) * 300 + 25) * low;
    }
    h *= 1 - level;
    // the stream's bed (never under the bridge), widening into a pond on the left
    const sd = Math.min(Math.abs(z - streamZ(x)), STREAM.half + pondD(x, z));
    if (sd < 8 && a > 2.9) {
      const bank = 1 - smoothstep(STREAM.half - 0.6, STREAM.half + 2.2, sd);
      h = h * (1 - bank) - STREAM.depth * bank * smoothstep(2.9, 3.3, a);
    }
    return h;
  }

  // ------------------------------------------------------------------ sky light
  setupSkyLight() {
    const S = this.skyMeta;
    // haze colours: the sky just above the horizon round the view (display-linear, stored as sRGB bytes)
    const { w, h, rgb } = S.haze;
    const data = new Uint8Array(w * h * 4);
    const enc = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = enc(rgb[i * 3]); data[i * 4 + 1] = enc(rgb[i * 3 + 1]); data[i * 4 + 2] = enc(rgb[i * 3 + 2]); data[i * 4 + 3] = 255;
    }
    const ht = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    ht.colorSpace = THREE.SRGBColorSpace;
    ht.magFilter = ht.minFilter = THREE.LinearFilter;
    ht.needsUpdate = true;
    HAZE_U.uHazeTex.value = ht;
    HAZE_U.uHazeMap.value.set(S.haze.az[0] * DEG, S.haze.az[1] * DEG, S.haze.el[0] * DEG, S.haze.el[1] * DEG);
    // image-based light: the baked HDR (sun clamped, exposed like the background), turned like the sky
    this.scene.environment = this.A.sky.light;
    this.scene.environmentRotation = new THREE.Euler(0, S.theta, 0);
    this.scene.environmentIntensity = LIGHT.sky;
    S.sh.forEach((c, i) => this.shU.value[i].set(c[0] * LIGHT.warm[0], c[1] * LIGHT.warm[1], c[2] * LIGHT.warm[2]).multiplyScalar(LIGHT.sky));
  }

  // ------------------------------------------------------------------ materials
  makeMaterials() {
    const sets = this.A.sets, T = this.tex;
    const pbr = (key, set, o = {}) => haze(new THREE.MeshStandardMaterial({
      vertexColors: true, map: set.map, normalMap: set.normal, roughnessMap: set.rough, roughness: 1, metalness: 0, ...o,
    }), key);
    const flat = (key, o, ibl) => haze(new THREE.MeshStandardMaterial({ vertexColors: true, map: T.flat.map, normalMap: T.flat.normal, roughnessMap: T.flat.map, ...o }), key, null, ibl);
    return {
      // roughness multiplies the scan's roughness map (clamped at 1): lime plaster, old wood and stone are matte,
      // otherwise the low sun glares off facades seen edge-on
      plaster: pbr('plaster', sets.plaster, { normalScale: new THREE.Vector2(0.8, 0.8), roughness: 2 }),
      timber: pbr('timber', sets.timber, { normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1.6 }),
      planks: pbr('planks', sets.planks, { roughness: 1.5 }),
      brick: pbr('brick', sets.brick, { roughness: 1.4 }),
      stone: pbr('stone', sets.stone, { roughness: 1.4 }),
      ashlar: pbr('ashlar', sets.ashlar, { roughness: 1.4 }),
      clay: pbr('clay', sets.clay, { normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1.15 }),
      slate: pbr('slate', sets.slate, { normalScale: new THREE.Vector2(1.1, 1.1), roughness: 1.0 }),
      thatch: pbr('thatch', sets.thatch, { normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1.8 }),
      bark: pbr('bark', sets.bark, { roughness: 1.6 }),
      iron: flat('iron', { roughness: 0.5, metalness: 0.6 }),
      plain: flat('plain', { roughness: 0.75 }),
      sign: haze(new THREE.MeshStandardMaterial({ vertexColors: true, map: T.signs, normalMap: T.flat.normal, roughnessMap: T.flat.map, roughness: 0.8 }), 'sign'),
      awning: this.cloth(T.awning, 0),
      glass: haze(new THREE.MeshBasicMaterial({ vertexColors: true, map: T.window }), 'glass'),
    };
  }

  /** Banners and awnings: one program; banners wave (amp 1), awnings hang still (amp 0). */
  cloth(map, amp) {
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide });
    const uAmp = { value: amp };
    haze(mat, 'cloth', (sh) => {
      sh.uniforms.uT = this.timeU;
      sh.uniforms.uAmp = uAmp;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT, uAmp;')
        .replace('// @wind', `{
          float hang = uv.y; // 0 where the cloth is fixed (top), 1 at its free end
          float k = (0.25 + uv.x) * (0.3 + hang) * uAmp;
          hzW.x += sin(uT * 2.2 + uv.y * 3.0 + hzW.z) * 0.07 * k;
          hzW.z += sin(uT * 2.9 + uv.y * 4.0 + uv.x * 2.0 + hzW.x) * 0.16 * k;
        }`);
    });
    return mat;
  }

  /** Haze + curve on a loaded glTF material (keeps its maps; no transmission, which would cost a whole extra pass). */
  adopt(mat) {
    if (mat.userData.adopted) return mat;
    mat.userData.adopted = true;
    if (mat.isMeshPhysicalMaterial) { mat.transmission = 0; mat.thickness = 0; }
    mat.transparent = false;
    if (mat.isMeshStandardMaterial) haze(mat, 'gltf', null, 'sh');
    return mat;
  }

  // ------------------------------------------------------------------ sky
  buildSky() {
    const S = this.skyMeta;
    this.skyU = {
      uWin: { value: this.A.sky.window },
      uPano: { value: this.A.sky.pano },
      uWinMap: { value: new THREE.Vector4(S.window.az[0], S.window.az[1], S.window.el[0], S.window.el[1]) },
      uTheta: { value: S.theta },
      uGain: { value: 1 },
    };
    const dome = new THREE.SphereGeometry(4000, 256, 128);
    const sky = new THREE.Mesh(dome, new THREE.ShaderMaterial({
      uniforms: this.skyU,
      side: THREE.BackSide,
      depthWrite: false,
      // the window's uv is interpolated from the dome's vertices (fine enough that it's exact to a fraction of a
      // texel in view; the seam behind the camera is never seen); the panorama keeps per-pixel directions
      vertexShader: /* glsl */ `
        uniform vec4 uWinMap;
        varying vec3 vDir;
        varying vec2 vWin;
        void main() {
          vDir = position;
          vec3 d = normalize(position);
          vWin = vec2((atan(d.x, -d.z) - uWinMap.x) / (uWinMap.y - uWinMap.x), (asin(clamp(d.y, -1.0, 1.0)) - uWinMap.z) / (uWinMap.w - uWinMap.z));
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uWin, uPano;
        uniform float uTheta, uGain;
        varying vec3 vDir;
        varying vec2 vWin;
        void main() {
          vec2 w = vWin;
          vec3 col;
          if (w.x > 0.0 && w.x < 1.0 && w.y > 0.0 && w.y < 1.0) {
            col = texture2D(uWin, w).rgb;
          } else {
            vec3 d = normalize(vDir);
            // the rest of the sky: three's equirect convention, turned like the environment light
            vec3 r = vec3(d.x * cos(uTheta) - d.z * sin(uTheta), d.y, d.x * sin(uTheta) + d.z * cos(uTheta));
            col = texture2D(uPano, vec2(atan(r.z, r.x) * 0.15915494 + 0.5, asin(clamp(r.y, -1.0, 1.0)) * 0.31830989 + 0.5)).rgb;
          }
          gl_FragColor = vec4(col * uGain, 1.0);
        }
      `,
    }));
    sky.frustumCulled = false;
    sky.renderOrder = 100;
    this.sky = sky;
    this.scene.add(sky);
  }

  // ------------------------------------------------------------------ the sun
  buildSun() {
    const a = SUN.az * DEG, e = SUN.el * DEG;
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    this.sunDir = dir;
    const col = new THREE.Color(...this.skyMeta.sun.color).lerp(new THREE.Color(1, 0.9, 0.74), 0.58);
    const sun = new THREE.DirectionalLight(col, LIGHT.sun);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    // nothing that casts a shadow moves much: one static map over the whole ride corridor
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    const z = dir.clone();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
    const y = z.clone().cross(x);
    const c0 = new THREE.Vector3(0, 0, -45);
    const ext = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
    for (const px of [-26, 26]) for (const py of [-2, 17]) for (const pz of [-82, 64]) {
      const p = new THREE.Vector3(px, py, pz);
      for (const [k, ax] of [['x', x], ['y', y], ['z', z]]) { const v = p.dot(ax); ext[k][0] = Math.min(ext[k][0], v); ext[k][1] = Math.max(ext[k][1], v); }
    }
    const D = 260;
    sun.target.position.copy(c0);
    sun.position.copy(c0).addScaledVector(z, D);
    const cam = sun.shadow.camera;
    cam.left = ext.x[0]; cam.right = ext.x[1]; cam.bottom = ext.y[0]; cam.top = ext.y[1];
    cam.near = D - ext.z[1] - 120;
    cam.far = D - ext.z[0] + 5;
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ land, road and the stream
  buildTerrain() {
    const sets = this.A.sets, T = this.tex;
    // columns follow the road: offsets from its centre line, fine near it, coarse far out
    const cols = [0];
    for (let s = 0.25; s <= 2.5; s += 0.25) cols.push(s);
    cols.push(2.8, 2.95, 3.2);
    for (let s = 3.2, ds = 0.35; s < 110; ds *= 1.1) { s += ds; cols.push(Math.min(s, 110)); }
    const S = [...cols.slice(1).map((v) => -v).reverse(), ...cols];
    const rows = [];
    for (let z = 22; z > -110; z -= 0.5) rows.push(z);
    for (let z = -110, dz = 0.5; z > -190; dz *= 1.06) { z -= dz; rows.push(Math.max(z, -190)); }
    const nc = S.length, nr = rows.length;
    const pos = new Float32Array(nc * nr * 3), col = new Float32Array(nc * nr * 3);
    const c = new THREE.Color(), warm = new THREE.Color(1.12, 1.06, 0.78), cool = new THREE.Color(0.8, 0.9, 0.82), white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < nr; i++) {
      const z = rows[i], tx = trailX(z);
      for (let j = 0; j < nc; j++) {
        const x = tx + S[j];
        const k = i * nc + j;
        pos[k * 3] = x; pos[k * 3 + 1] = this.groundAt(x, z); pos[k * 3 + 2] = z;
        const a = Math.abs(S[j]);
        const n1 = fbm(x * 0.06 + 11, z * 0.06 - 3, 3), n2 = fbm(x * 0.2, z * 0.2, 2);
        c.copy(white).lerp(warm, clamp(n1 * 1.4)).lerp(cool, clamp(-n1 * 1.4)).multiplyScalar(0.92 + n2 * 0.16);
        c.lerp(white, 1 - smoothstep(2.0, 4.0, a));
        // wet, darker banks along the stream
        const sd = Math.abs(z - streamZ(x));
        c.multiplyScalar(1 - 0.35 * (1 - smoothstep(STREAM.half, STREAM.half + 1.6, sd)) * smoothstep(2.9, 3.4, a));
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    const idx = [];
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j, b = a + 1, d = a + nc, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const R = sets.road, G = sets.grass, Vg = sets.verge;
    haze(mat, 'ground', (sh) => {
      Object.assign(sh.uniforms, {
        tRoadC: { value: R.map }, tRoadN: { value: R.normal }, tRoadR: { value: R.rough },
        tGrassC: { value: G.map }, tVergeC: { value: Vg.map }, tVergeN: { value: Vg.normal },
        tNoise: { value: T.noise },
        uTrail: { value: new THREE.Vector4(1.1, 0.055, 0.5, -0.45) },
        uSquare: { value: new THREE.Vector4(SQUARE.x0, SQUARE.x1, SQUARE.z0, SQUARE.z1) },
        uTiles: { value: new THREE.Vector3(1 / R.size, 1 / G.size, 1 / Vg.size) },
      });
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tRoadC, tRoadN, tRoadR, tGrassC, tVergeC, tVergeN, tNoise;
          uniform vec4 uTrail, uSquare; uniform vec3 uTiles;
          float wRoad, wVerge, wGrass; vec2 gWp;`)
        .replace('#include <map_fragment>', /* glsl */ `{
          gWp = vHazeW.xz;
          float dx = gWp.x - (uTrail.x * sin(gWp.y * uTrail.y + uTrail.z) + uTrail.w);
          vec4 nz = texture2D(tNoise, gWp * 0.06);
          float ad = abs(dx) + (nz.r - 0.5) * 0.55 + (nz.g - 0.5) * 0.3;
          float sq = smoothstep(uSquare.x - 0.6, uSquare.x + 0.6, dx + (nz.g - 0.5) * 1.6) * (1.0 - step(0.0, dx))
                   * smoothstep(uSquare.z - 0.6, uSquare.z + 0.6, gWp.y + (nz.r - 0.5) * 1.6) * (1.0 - smoothstep(uSquare.w - 0.6, uSquare.w + 0.6, gWp.y + (nz.g - 0.5) * 1.6));
          wRoad = max(1.0 - smoothstep(2.3, 2.6, ad), sq);
          float far = smoothstep(4.2, 9.0, ad + (nz.r - 0.5) * 5.0);
          wVerge = (1.0 - wRoad) * (1.0 - far);
          wGrass = 1.0 - wRoad - wVerge;
          vec3 c = vec3(0.0);
          if (wRoad > 0.002) {
            // macro variation so the cobbles don't fade to one flat grey in the distance: dusty patches, worn ruts
            float rut = exp(-pow((abs(dx) - 0.78) / 0.32, 2.0));
            vec3 rc = texture2D(tRoadC, gWp * uTiles.x).rgb * mix(vec3(0.8, 0.78, 0.76), vec3(1.1, 1.04, 0.95), nz.r) * (1.0 - 0.12 * rut);
            c += wRoad * rc;
          }
          if (wVerge > 0.002) c += wVerge * texture2D(tVergeC, gWp * uTiles.z).rgb * vec3(0.95, 0.92, 0.85);
          if (wGrass > 0.002) c += wGrass * texture2D(tGrassC, gWp * uTiles.y).rgb * vec3(1.0, 1.06, 0.9);
          diffuseColor.rgb *= c;
        }`)
        .replace('#include <roughnessmap_fragment>', /* glsl */ `
          // only the cobbles have the scan's roughness and relief; earth and grass are matte, their relief is in
          // the colour (and the grass blades)
          float roughnessFactor = 1.0 - wRoad;
          if (wRoad > 0.002) roughnessFactor += wRoad * clamp(texture2D(tRoadR, gWp * uTiles.x).g * 1.15, 0.6, 1.0);`)
        .replace('#include <normal_fragment_maps>', /* glsl */ `
          if (vHaze.a < 0.2 && wRoad > 0.002) {
            vec3 mn = mix(vec3(0.0, 0.0, 1.0), texture2D(tRoadN, gWp * uTiles.x).xyz * 2.0 - 1.0, wRoad);
            if (wVerge > 0.002) mn = mix(mn, texture2D(tVergeN, gWp * uTiles.z).xyz * 2.0 - 1.0, wVerge * 0.7);
            mn = normalize(mn + vec3(0.0, 0.0, 1e-3));
            // world-aligned tangent frame: u along +x, v along -z (textures are laid flat, v up = -z)
            vec3 Tn = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
            vec3 Bn = normalize((viewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
            Tn = normalize(Tn - normal * dot(normal, Tn));
            Bn = normalize(Bn - normal * dot(normal, Bn) - Tn * dot(Tn, Bn));
            normal = normalize(mat3(Tn, Bn, normal) * mn);
          }`);
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.renderOrder = 4;
    this.scene.add(m);
    this.terrain = m;
  }

  /** The stream: a reflective ribbon in its bed, rippling, with stones on its banks. */
  buildWater() {
    const segs = 120, x0 = -90, x1 = 90;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const x = x0 + (x1 - x0) * (i / segs);
      const zc = streamZ(x);
      const hw = STREAM.half + 0.6;
      for (const s of [-1, 1]) { pos.push(x, -STREAM.depth + 0.38, zc + s * hw); uv.push(x / 6, (zc + s * hw) / 6); }
      if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    // the pond: a disc (squashed like its bed) joined to the stream
    {
      const n = 48, base = pos.length / 3;
      pos.push(POND.x, -STREAM.depth + 0.38, POND.z); uv.push(POND.x / 6, POND.z / 6);
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * TAU, rr = POND.r + 0.7;
        const x = POND.x + Math.cos(a) * rr / 0.8, z = POND.z + Math.sin(a) * rr;
        pos.push(x, -STREAM.depth + 0.38, z); uv.push(x / 6, z / 6);
        if (k < n) idx.push(base, base + 2 + k, base + 1 + k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const ripples = this.tex.ripples;
    this.waterMat = haze(new THREE.MeshStandardMaterial({ color: C('#2f5a5a'), roughness: 0.07, metalness: 0, normalMap: ripples, normalScale: new THREE.Vector2(0.28, 0.28) }), 'water', null, 'pmrem');
    const m = new THREE.Mesh(g, this.waterMat);
    m.receiveShadow = true;
    m.renderOrder = 3;
    this.scene.add(m);
    // stones along the banks
    const B = new Batch(), r = rng(808);
    for (let k = 0; k < 70; k++) {
      const x = (r() - 0.5) * 70;
      if (Math.abs(x - XR) < 3.4) continue;
      const s = r() < 0.5 ? -1 : 1;
      const z = streamZ(x) + s * (STREAM.half - 0.2 + r() * 1.2);
      const rad = 0.18 + r() * 0.35;
      const st = new THREE.IcosahedronGeometry(rad, 1);
      const p = st.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.6);
      st.deleteAttribute('normal');
      const wg = mergeVertices(st);
      wg.computeVertexNormals();
      B.add('stone', paint(wg, C('#b8b0a0').multiplyScalar(0.7 + r() * 0.4)), M(x, this.groundAt(x, z) + rad * 0.2, z, r(), r() * TAU, 0));
    }
    this.addBatch(B, { stone: ['stone'] }, { cast: false });
    this.footprints = [{ stream: true }];
  }

  /** Hills, the castle's hill and the mountains: a polar grid round the village, vertex coloured. */
  buildFar() {
    const O = new THREE.Vector2(0, -12);
    const A0 = -46 * DEG, A1 = 46 * DEG;
    const na = 130, rings = [];
    for (let r = 100; r < 4200; r *= 1.06) rings.push(r);
    const nr = rings.length;
    const pos = new Float32Array(na * nr * 3), col = new Float32Array(na * nr * 3);
    const c = new THREE.Color();
    const meadow = C('#86a04c'), dry = C('#c0a862'), forest = C('#2f4a2c'), rockC = C('#8a7f78');
    for (let i = 0; i < nr; i++) {
      const r = rings[i];
      for (let j = 0; j < na; j++) {
        const a = A0 + (A1 - A0) * (j / (na - 1));
        const x = O.x + Math.sin(a) * r, z = O.y - Math.cos(a) * r;
        let h = this.groundAt(x, z);
        const sNear = Math.abs(x - trailX(z));
        h -= (1 - smoothstep(95, 112, sNear)) * smoothstep(-195, -180, z) * 4;
        const k = (i * na + j) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        const n = fbm(x * 0.01 + 5, z * 0.01, 4), n2 = fbm(x * 0.04, z * 0.04, 2);
        c.copy(meadow).lerp(dry, clamp(0.5 + n * 1.2)).multiplyScalar(0.9 + n2 * 0.2);
        c.lerp(forest, smoothstep(0.05, 0.25, fbm(x * 0.006 - 4, z * 0.006 + 9, 4)) * (1 - smoothstep(150, 260, h)) * smoothstep(150, 320, r));
        c.lerp(rockC, smoothstep(90, 200, h) * 0.85);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    const idx = [];
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < na - 1; j++) {
      const a = i * na + j, b = a + 1, d = a + na, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(mergeGeometries([g, this.forestGeometry()]), haze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), 'far'));
    m.renderOrder = 5;
    this.scene.add(m);
    this.buildCastle();
  }

  /** The castle on its hill at the end of the road: curtain wall, round towers, the keep and spires. */
  buildCastle() {
    const B = new Batch();
    const gy = this.groundAt(CASTLE.x, CASTLE.z);
    const stone = new THREE.Color(1, 0.97, 0.92);
    const roofC = C('#6f8fc8');
    const add = (key, g, x, y, z) => B.add(key, g, M(x, y, z));
    const R = 24;
    for (let k = 0; k < 7; k++) {
      const a0 = (k / 7) * TAU, a1 = ((k + 1) / 7) * TAU;
      const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      const len = Math.hypot(x1 - x0, z1 - z0);
      B.add('ashlar', box(len, 10, 2.6, stone), M((x0 + x1) / 2, 5, (z0 + z1) / 2, 0, -Math.atan2(z1 - z0, x1 - x0), 0));
      add('ashlar', cyl(3.4, 3.8, 15, 16, stone), x0, 7.5, z0);
      add('slate', cyl(0, 4.4, 7.5, 16, roofC), x0, 18.7, z0);
    }
    add('ashlar', box(15, 28, 13, stone), 0, 14, 0);
    const kr = new THREE.ConeGeometry(11.2, 10, 4, 1);
    kr.rotateY(Math.PI / 4);
    kr.scale(1, 1, 0.87);
    B.add('slate', paint(kr, roofC), M(0, 33, 0));
    for (const [x, z, h] of [[-7.5, -6.5, 38], [7.5, 6.5, 34], [6.5, -6.5, 43], [-6, 7, 30]]) {
      add('ashlar', cyl(2.5, 2.7, h, 16, stone), x, h / 2, z);
      add('slate', cyl(0, 3.3, 10, 16, roofC), x, h + 5, z);
    }
    for (let k = 0; k < 22; k++) {
      if (hash(k, 3) < 0.4) continue;
      add('glow', box(1.0, 1.6, 0.3, C('#ffb860').multiplyScalar(1.5)), -6 + (k % 6) * 2.2, 11 + Math.floor(k / 6) * 5, 6.6);
    }
    const mtx = M(CASTLE.x, gy - 4, CASTLE.z, 0, 0.5, 0);
    for (const key of Object.keys(B.parts)) for (const g of B.parts[key]) g.applyMatrix4(mtx);
    this.addBatch(B, { ashlar: ['ashlar'], slate: ['slate'], glass: ['glow'] }, { cast: false, receive: false, order: 5 });
  }

  /** Woods on the hills: lumpy blobs merged into the far terrain (same material), hazy in the distance. */
  forestGeometry() {
    let base = new THREE.IcosahedronGeometry(1, 1);
    base.deleteAttribute('uv');
    base.deleteAttribute('normal');
    base = mergeVertices(base);
    const p = base.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = 1 + 0.12 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4 + x * 2);
      p.setXYZ(i, x * f, Math.max(y, -0.4) * f * 1.3 + 0.9, z * f);
    }
    base.computeVertexNormals();
    const r = rng(611);
    const out = [];
    const green = C('#3f6a38');
    for (let tries = 0; tries < 20000 && out.length < 300; tries++) {
      const a = (r() - 0.5) * 1.2, d = 250 + Math.pow(r(), 0.7) * 800;
      const x = Math.sin(a) * d, z = -12 - Math.cos(a) * d;
      if (fbm(x * 0.006 - 4, z * 0.006 + 9, 4) < 0.08 && r() < 0.85) continue;
      const h = this.groundAt(x, z);
      if (h > 170) continue;
      if (Math.abs(x - CASTLE.x) < 34 && Math.abs(z - CASTLE.z) < 34) continue;
      if (Math.abs(x - trailX(z)) < 8) continue;
      const sc = 3 + r() * 3.5;
      const g = paint(base.clone(), green.clone().multiplyScalar(0.75 + r() * 0.5));
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * TAU, 0)), new THREE.Vector3(sc, sc * (1 + r() * 0.4), sc)));
      out.push(g);
    }
    return mergeGeometries(out);
  }

  /** Merge a batch's parts into one mesh per material: groups = { material: [batch keys] }. */
  addBatch(B, groups, { cast = true, receive = true, order = 2 } = {}) {
    const meshes = [];
    // lamp glass and other glowing bits use the window material: point their uvs at a bright pane
    for (const g of B.parts.glow || []) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.62); }
    for (const [mat, keys] of Object.entries(groups)) {
      const parts = keys.flatMap((k) => B.parts[k] || []);
      if (!parts.length) continue;
      const tmp = new Batch();
      tmp.parts[keys[0]] = parts;
      const mesh = new THREE.Mesh(tmp.build(keys[0]), this.mats[mat]);
      mesh.renderOrder = order;
      mesh.castShadow = cast && !['glass', 'plain', 'iron', 'awning', 'sign'].includes(mat);
      mesh.receiveShadow = receive && mat !== 'glass';
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  // ------------------------------------------------------------------ the village
  buildVillage() {
    const r = rng(41);
    const B = new Batch();
    this.chimneys = [];
    this.lamps = []; // { hook, ry }: where a lantern hangs
    this.glowPts = [];
    this.fronts = [];
    this.props = { barrel: [], crate: [], bucket: [], shield: [] };
    const place = (x, z, ry, y = null) => M(x, y ?? this.groundAt(x, z), z, 0, ry, 0);
    const roadX = (z, side, off) => trailX(z) + side * off;

    // ---- the town gate
    const gt = gate(r);
    const gm = place(trailX(GATE_Z), GATE_Z, 0, 0);
    B.take(gt.B, gm);
    for (const l of gt.anchors.lamps) this.lamps.push({ hook: l.pos.clone().applyMatrix4(gm).add(new THREE.Vector3(0, 0.45, 0)), ry: 0 });
    this.gateBanners = gt.anchors.banners.map((b) => new THREE.Vector3(b.x, b.y, b.z).applyMatrix4(gm));
    this.footprints.push({ x: trailX(GATE_Z), z: GATE_Z - 0.6, hx: 40, hz: 2.4, ignoreRoad: true });

    // ---- houses: fronts to the road. The left side (towards the low sun) keeps gaps and the square, so light
    // crosses the street; the inn and smithy sit on the sunlit right.
    const HOUSES = [
      { z: -8.6, side: -1, floors: 2, along: true, roof: 'clay', w: 6.8, set: 6.3 },
      { z: -16.8, side: -1, floors: 1, along: false, roof: 'thatch', w: 5.8, set: 6.5, pitch: 52 },
      { z: -33.4, side: -1, floors: 2, along: false, roof: 'slate', w: 6.0, set: 6.8, sign: 3, awning: 3 },
      { z: -60.5, side: -1, floors: 2, along: true, roof: 'clay', w: 7.2, set: 7.5 },
      { z: -69.5, side: -1, floors: 2, along: false, roof: 'slate', w: 6.2, set: 7.6, sign: 2, awning: 2 },
      { z: -78.5, side: -1, floors: 1, along: true, roof: 'thatch', w: 6.6, set: 7.6, pitch: 50 },
      { z: -87.5, side: -1, floors: 2, along: false, roof: 'clay', w: 6.6, set: 7.3 },
      { z: -97.0, side: -1, floors: 2, along: true, roof: 'slate', w: 7.4, set: 7.0 },
      { z: -106.5, side: -1, floors: 1, along: false, roof: 'thatch', w: 6.0, set: 7.4, pitch: 52 },
      { z: -116.0, side: -1, floors: 2, along: true, roof: 'clay', w: 7.0, set: 7.8 },
      { z: -7.4, side: 1, floors: 2, along: false, roof: 'slate', w: 6.2, set: 6.2 },
      { z: -15.4, side: 1, floors: 2, along: true, roof: 'clay', w: 6.8, set: 6.5, awning: 1 },
      { z: -31.6, side: 1, floors: 1, along: true, roof: 'slate', w: 7.8, set: 6.9, groundStone: true, sign: 1, smithy: true, pitch: 40 },
      { z: -43.5, side: 1, floors: 3, along: true, roof: 'clay', w: 10.6, d: 7.4, set: 7.2, sign: 0, porch: true, inn: true, pitch: 44, litChance: 0.8 },
      { z: -55.0, side: 1, floors: 2, along: false, roof: 'thatch', w: 6.2, set: 7.7, pitch: 50 },
      { z: -63.8, side: 1, floors: 2, along: true, roof: 'clay', w: 7.0, set: 7.9, awning: 0 },
      { z: -72.6, side: 1, floors: 1, along: false, roof: 'slate', w: 6.0, set: 7.9, pitch: 50 },
      { z: -89.0, side: 1, floors: 2, along: true, roof: 'clay', w: 7.4, set: 7.3 },
      { z: -98.0, side: 1, floors: 2, along: false, roof: 'slate', w: 6.4, set: 7.1 },
      { z: -107.5, side: 1, floors: 2, along: true, roof: 'clay', w: 7.2, set: 7.4 },
      { z: -117.5, side: 1, floors: 1, along: false, roof: 'thatch', w: 6.2, set: 8.0, pitch: 50 },
      // the square's far side (facing the road across it)
      { z: -40.0, side: -1, floors: 2, along: true, roof: 'clay', w: 7.4, set: 20.0, back: true },
      { z: -50.5, side: -1, floors: 2, along: false, roof: 'slate', w: 6.4, set: 20.5, back: true },
    ];
    for (const H of HOUSES) {
      const w = H.w, d = H.d ?? 5.4 + r() * 1.0;
      const roofTint = H.roof === 'clay' ? PALETTE.clay[Math.floor(r() * PALETTE.clay.length)] : H.roof === 'slate' ? PALETTE.slate[Math.floor(r() * PALETTE.slate.length)] : PALETTE.thatch[Math.floor(r() * PALETTE.thatch.length)];
      const o = {
        w, d, floors: H.floors, ridgeAlongX: H.along, pitch: (H.pitch ?? 44 + r() * 6) * DEG,
        groundStone: H.groundStone ?? r() < 0.25, wall: PALETTE.walls[Math.floor(r() * PALETTE.walls.length)],
        roofKey: H.roof, roof: roofTint,
        shutter: r() < 0.65 ? PALETTE.shutters[Math.floor(r() * PALETTE.shutters.length)] : null,
        doorColor: PALETTE.doors[Math.floor(r() * PALETTE.doors.length)].clone().multiplyScalar(0.9 + r() * 0.2),
        sign: H.sign, awning: H.awning, porch: H.porch, litChance: H.litChance ?? 0.45,
        h1: H.inn ? 3.0 : 2.75, h2: 2.45, h3: 2.35,
      };
      o.hidden = new Set(['back', H.side < 0 ? 'right' : 'left']);
      if (H.back) o.hidden = new Set(['back', 'left', 'right']);
      const hs = cottage(r, o);
      const x = roadX(H.z, H.side, H.set + d / 2);
      const ry = H.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const mtx = place(x, H.z, ry, Math.min(this.groundAt(x, H.z - w / 2), this.groundAt(x, H.z + w / 2), this.groundAt(x, H.z)) - 0.04);
      B.take(hs.B, mtx);
      if (hs.anchors.smoke) this.chimneys.push(hs.anchors.smoke.clone().applyMatrix4(mtx));
      for (const l of hs.anchors.lamps) this.lamps.push({ hook: l.pos.clone().applyMatrix4(mtx).add(new THREE.Vector3(0, 0.24, 0)), ry });
      for (const g of hs.anchors.glow) this.glowPts.push(g.clone().applyMatrix4(mtx));
      this.footprints.push({ x, z: H.z, hx: d / 2 + 1.0, hz: w / 2 + 0.7 });
      const front = x - H.side * (d / 2);
      this.fronts.push({ x: front, z: H.z, w, side: H.side, door: hs.anchors.door ? hs.anchors.door.pos.clone().applyMatrix4(mtx) : null, inn: H.inn, smithy: H.smithy, back: H.back });
    }

    // ---- lamp posts along the road, alternating sides, arms over the road's edge
    for (let k = 0; k < 12; k++) {
      const z = -5.5 - k * 8.6;
      if (Math.abs(z - STREAM.z) < 5) continue;
      const side = k % 2 ? 1 : -1;
      const x = roadX(z, side, 3.45);
      const m = place(x, z, side < 0 ? 0 : Math.PI);
      this.lamps.push({ hook: lampPost(B, m), ry: side < 0 ? 0 : Math.PI });
      this.footprints.push({ x, z, hx: 0.4, hz: 0.4 });
    }

    // ---- the bridge
    const bm = place(XR, STREAM.z, 0, 0);
    B.take(bridgeParapets(10.5), bm);
    for (const s of [-1, 1]) for (const dz of [-5.6, 5.6]) this.footprints.push({ x: XR + s * 3.0, z: STREAM.z + dz, hx: 0.6, hz: 0.6 });

    // ---- the market square: stalls, the well, a cart, crates and barrels, a big tree (buildTrees)
    const sqX = (z, dx) => trailX(z) + dx;
    // stalls line the road's edge along the square (the camera's narrow view sees little of the square itself)
    const STALLS = [[-37.6, -4.7, 0.05, 1], [-42.4, -4.8, -0.06, 0], [-47.2, -4.7, 0.04, 2], [-52.0, -4.9, -0.05, 3], [-57.8, 4.9, Math.PI + 0.05, 0], [-44.8, -12.4, Math.PI / 2 + 0.2, 3]];
    this.marks = [];
    for (const [z, dx, ry, row] of STALLS) {
      const x = sqX(z, dx);
      const sm = place(x, z, Math.PI / 2 + ry);
      stall(B, sm, r, row);
      // the stallholder behind the counter, and now and then a customer in front
      villager(B, sm.clone().multiply(M(0.3 * (r() - 0.5), 0, -0.95)), r, { apron: r() < 0.6 });
      if (r() < 0.55) villager(B, sm.clone().multiply(M((r() - 0.5) * 1.6, 0, 1.75, 0, Math.PI + (r() - 0.5) * 0.8, 0)), r);
      this.footprints.push({ x, z, hx: 1.6, hz: 1.9 });
      this.props.crate.push(M(x + 0.6, this.groundAt(x, z), z + 2.1, 0, r() * 0.6, 0));
      if (r() < 0.6) this.props.barrel.push(M(x - 0.4, this.groundAt(x, z), z - 2.2, 0, r() * TAU, 0));
    }
    const wz = -55.4, wx = sqX(wz, -6.9);
    well(B, place(wx, wz, 0.4));
    this.props.bucket.push(M(wx + 1.15, this.groundAt(wx, wz), wz + 0.6, 0, r(), 0));
    this.footprints.push({ x: wx, z: wz, hx: 1.6, hz: 1.6 });
    // bunting strung between poles along the stalls (beside the road, under the title screens' corridor)
    {
      const poles = [-35.4, -40.0, -44.8, -49.6, -54.4].map((z) => new THREE.Vector3(sqX(z, -3.75), 0, z));
      for (const p of poles) {
        p.y = this.groundAt(p.x, p.z);
        B.add('timber', box(0.13, 4.0, 0.13, PALETTE.timber), M(p.x, p.y + 2.0, p.z));
        this.footprints.push({ x: p.x, z: p.z, hx: 0.3, hz: 0.3 });
      }
      for (let k = 0; k < poles.length - 1; k++) bunting(B, poles[k].clone().setY(poles[k].y + 3.9), poles[k + 1].clone().setY(poles[k + 1].y + 3.9), 0.45);
      // and across the square towards the cart
      bunting(B, poles[0].clone().setY(poles[0].y + 3.9), new THREE.Vector3(sqX(-35.2, -12), this.groundAt(sqX(-35.2, -12), -35.2) + 4.6, -35.2), 0.5);
    }
    const cz = -36.0, cx = sqX(cz, -15.5);
    cart(B, place(cx, cz, 0.7), r);
    this.footprints.push({ x: cx, z: cz, hx: 1.6, hz: 2.0 });
    // banners round the square and at the bridge
    this.banners = [];
    for (const [z, side, off] of [[-18.6, -1, 3.6], [-18.6, 1, 3.6], [-34.4, -1, 3.6], [-60.6, -1, 3.6], [-52.5, 1, 3.7]]) {
      const x = roadX(z, side, off);
      B.take(propBatch(bannerPole), place(x, z, side < 0 ? 0 : Math.PI));
      this.banners.push({ x, y: this.groundAt(x, z), z, side });
      this.footprints.push({ x, z, hx: 0.4, hz: 0.4 });
    }

    // ---- the inn: benches, barrels and a lantern by the door; the smithy: anvil, shields, woodpile
    for (const f of this.fronts) {
      if (f.back || !f.door) continue;
      const out = -f.side; // towards the road
      if (f.inn) {
        for (const dz of [-2.6, 2.4]) B.take(propBatch(bench), place(f.x + out * 0.75, f.door.z + dz, f.side < 0 ? Math.PI / 2 : -Math.PI / 2));
        for (let k = 0; k < 3; k++) this.props.barrel.push(M(f.x + out * (0.65 + (k % 2) * 0.55), this.groundAt(f.x, f.z), f.z + 4.1 + k * 0.62, 0, r() * TAU, 0));
      }
      if (f.smithy) {
        const ax = f.x + out * 1.9, az = f.door.z + 2.2;
        B.take(propBatch(anvil), place(ax, az, 0.4));
        for (let k = 0; k < 3; k++) this.props.shield.push(M(f.x + out * 0.06, 1.15, f.z - 2.6 + k * 1.15, 0, (f.side < 0 ? Math.PI / 2 : -Math.PI / 2), 0));
        B.take(propBatch(woodpile, r), place(f.x + out * 0.4, f.z - 2.4, f.side < 0 ? Math.PI / 2 : -Math.PI / 2));
        this.props.barrel.push(M(ax + 0.9, this.groundAt(ax, az), az - 1.2, 0, r() * TAU, 0));
        this.footprints.push({ x: ax, z: az, hx: 0.8, hz: 0.8 });
      }
    }
    // folk: the innkeeper (with a quest), drinkers on the benches' side, the smith, a guard at the bridge (with a
    // quest), someone at the well; nobody stands on the road
    for (const f of this.fronts) {
      if (f.back || !f.door) continue;
      const out = -f.side, face = f.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      if (f.inn) {
        const kx = f.x + out * 2.0, kz = f.door.z + 1.2;
        villager(B, M(kx, this.groundAt(kx, kz), kz, 0, face + 0.3, 0), r, { apron: true, robe: C('#8a5a3a') });
        this.marks.push(new THREE.Vector3(kx, this.groundAt(kx, kz) + 2.35, kz));
        for (const [dz, rot] of [[-3.4, 0.9], [-4.3, -0.6]]) villager(B, M(f.x + out * 1.6, this.groundAt(f.x, f.z), f.door.z + dz, 0, face + rot, 0), r);
      }
      if (f.smithy) villager(B, M(f.x + out * 2.4, this.groundAt(f.x, f.z), f.door.z + 1.1, 0, face - 0.8, 0), r, { apron: true, robe: C('#4a3a30'), height: 1.06 });
    }
    {
      const gz = -17.2, gx = roadX(gz, -1, 4.3);
      villager(B, M(gx, this.groundAt(gx, gz), gz, 0, Math.PI / 2 - 0.25, 0), r, { robe: C('#1d6f78'), hood: true, height: 1.05 });
      this.marks.push(new THREE.Vector3(gx, this.groundAt(gx, gz) + 2.4, gz));
      this.footprints.push({ x: gx, z: gz, hx: 0.5, hz: 0.5 });
      const wz2 = -55.4, wx2 = roadX(wz2, -1, 8.4);
      villager(B, M(wx2, this.groundAt(wx2, wz2), wz2 + 1.3, 0, 2.6, 0), r);
      const sz = -30.2, sx = roadX(sz, 1, 3.9);
      signpost(B, place(sx, sz, 0.4), r);
      this.footprints.push({ x: sx, z: sz, hx: 0.5, hz: 0.5 });
      for (const [z, side, off, rot] of [[-27.6, 1, 4.6, -2.2], [-62.0, 1, 5.2, -1.2], [-66.5, -1, 5.0, 1.9], [-74.0, -1, 4.8, 1.3], [-9.6, 1, 4.4, -1.6], [-86.0, 1, 4.7, -1.9]]) {
        const x = roadX(z, side, off);
        if (this.blocked(x, z, true)) continue;
        villager(B, M(x, this.groundAt(x, z), z, 0, rot, 0), r);
        this.footprints.push({ x, z, hx: 0.4, hz: 0.4 });
      }
    }

    // barrels and crates by the houses and round the square
    for (let k = 0; k < 26; k++) {
      const f = this.fronts[Math.floor(r() * this.fronts.length)];
      if (f.back) continue;
      const out = -f.side;
      const z = f.z + (r() - 0.5) * f.w * 0.9;
      if (f.door && Math.abs(z - f.door.z) < 1.4) continue;
      const x = f.x + out * (0.55 + r() * 0.5);
      if (this.blocked(x, z, true)) continue;
      const kind = r();
      if (kind < 0.45) {
        B.take(propBatch(barrel, r), place(x, z, r() * TAU));
        if (r() < 0.4) B.take(propBatch(barrel, r), place(x, z + (r() < 0.5 ? 0.7 : -0.7), r() * TAU));
      } else if (kind < 0.8) {
        B.take(propBatch(crate, r), place(x, z, (r() - 0.5) * 0.6));
        if (r() < 0.4) B.take(propBatch(crate, r, 0.42), M(x, this.groundAt(x, z) + 0.6, z, 0, r(), 0));
      } else B.take(propBatch(sack, r), place(x, z, r() * TAU));
      this.footprints.push({ x, z, hx: 0.5, hz: 0.5 });
    }
    // a hay cart and bales by the gate, fences round the gardens
    B.take(propBatch(cart, r), place(roadX(-2.5, -1, 5.0), -2.5, 0.35));
    this.footprints.push({ x: roadX(-2.5, -1, 5.0), z: -2.5, hx: 1.6, hz: 2.0 });
    for (const [z, dx] of [[-3.5, 5.0], [-4.6, 6.2], [-11.8, -5.4]]) B.take(propBatch(haybale, r), place(roadX(z, 1, 0) + dx, z, r() * 0.6));
    for (const [z0, z1, side, off] of [[-11.5, -13.8, -1, 4.6], [-58.0, -56.2, -1, 4.2], [-67.0, -65.2, 1, 4.6], [-75.5, -74.0, 1, 4.4], [-83.0, -80.5, -1, 4.6], [-84.5, -81.0, 1, 4.4]]) {
      for (let z = z0; z > z1 - 0.6; z -= 1.6) {
        const za = z, zb = Math.max(z - 1.6, z1);
        if (za - zb < 0.3) break;
        const xa = roadX(za, side, off), xb = roadX(zb, side, off);
        const len = Math.hypot(xb - xa, zb - za);
        const ang = Math.atan2(-(zb - za), xb - xa);
        B.take(propBatch(fence, len, r), place((xa + xb) / 2, (za + zb) / 2, ang));
      }
    }
    // the bell tower behind the right-hand houses
    const tx = roadX(-81.5, 1, 16.5), tz = -81.5;
    B.take(bellTower(), place(tx, tz, 0.15, this.groundAt(tx, tz) - 0.3));
    this.footprints.push({ x: tx, z: tz, hx: 3.2, hz: 3.2 });

    // lanterns on every hook (posts, doors, the gate)
    for (const l of this.lamps) l.glass = lantern(B, M(l.hook.x, l.hook.y, l.hook.z, 0, l.ry || 0, 0));

    this.addBatch(B, {
      plaster: ['plaster'], timber: ['timber'], planks: ['planks'], brick: ['brick'], stone: ['stone'], ashlar: ['ashlar'],
      clay: ['clay'], slate: ['slate'], thatch: ['thatch'], bark: ['bark'], iron: ['iron'], plain: ['plain'],
      sign: ['sign'], awning: ['awning'], glass: ['glass', 'darkglass', 'glow'],
    });
    this.buildBanners();
    this.buildMarks();
  }

  /** Golden quest markers over the quest givers, bobbing and turning (MMO style). */
  buildMarks() {
    const geo = questMark();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.74, 0.12) });
    const rim = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.18, 0.02), side: THREE.BackSide });
    this.markMeshes = this.marks.map((p) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, mat));
      const o = new THREE.Mesh(geo, rim);
      o.scale.setScalar(1.18);
      g.add(o);
      g.position.copy(p);
      g.scale.setScalar(1.55);
      g.userData.y = p.y + 0.2;
      g.renderOrder = 2;
      this.scene.add(g);
      return g;
    });
  }

  buildBanners() {
    const geos = [];
    const banner = (x, y, z, ry, w = 0.85, h = 1.8) => {
      const g = new THREE.PlaneGeometry(w, h, 6, 10);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); // canvas top -> v 0
      g.translate(w / 2 + 0.06, -h / 2, 0);
      g.rotateY(ry);
      g.translate(x, y, z);
      geos.push(g);
    };
    for (const b of this.banners) banner(b.x, b.y + 4.2, b.z, b.side > 0 ? Math.PI : 0);
    for (const p of this.gateBanners || []) {
      const g = new THREE.PlaneGeometry(1.25, 3.4, 6, 12);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      g.translate(p.x, p.y - 1.7, p.z);
      geos.push(g);
    }
    const mat = this.cloth(this.tex.banner, 1);
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true;
    m.renderOrder = 2;
    this.scene.add(m);
  }

  // ------------------------------------------------------------------ the glTF props (instanced)
  buildModels() {
    const models = this.A.models;
    const put = (scene, list, { scale = 1, cast = true } = {}) => {
      if (!list.length) return;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld.clone().premultiply(new THREE.Matrix4().makeScale(scale, scale, scale)));
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) this.adopt(mt);
        const im = new THREE.InstancedMesh(geo, o.material, list.length);
        list.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = cast;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        im.renderOrder = 2;
        this.scene.add(im);
      });
    };
    put(models.barrel, this.props.barrel);
    put(models.crate, this.props.crate, { scale: 0.8 });
    put(models.bucket, this.props.bucket);
    put(models.shield, this.props.shield, { scale: 0.85, cast: false });
  }

  // ------------------------------------------------------------------ trees
  buildTrees() {
    const r = rng(73);
    const trunks = new Batch();
    const leaves = [], proxies = [];
    const spots = [];
    // the square's big tree, trees by the stream, between and behind the houses, and out in the meadows
    for (const [z, side, off, h] of [
      [-45.5, -1, 16.5, 10.5], [-17.6, -1, 9.0, 7.5], [-27.5, 1, 10.5, 8.0], [-30.5, -1, 18.5, 9.5], [-20.0, 1, 18, 9], [-23.5, -1, 20.5, 8.5],
      [-12.0, 1, 12.5, 7.5], [-3.5, -1, 11.5, 7.0], [-37.0, 1, 13.0, 8.0], [-50.0, 1, 12.5, 7.5], [-59.0, 1, 13.5, 8.5],
      [-64.5, -1, 12.0, 8.0], [-74.0, -1, 12.5, 7.5], [-82.5, -1, 11.0, 8.5], [-93.0, 1, 12.0, 8.0], [-103, -1, 9.5, 7.5], [-106, 1, 10.5, 8.0],
      [-67.5, 1, 13.0, 7.0], [-24.0, -1, 24, 9.5],
      // an avenue out of the village towards the castle
      [-125, -1, 6.5, 8.5], [-127, 1, 6.8, 9.0], [-136, -1, 7.0, 9.0], [-138, 1, 6.6, 8.5], [-147, -1, 6.8, 8.5], [-149, 1, 7.0, 9.5],
      [-158, -1, 7.2, 9.0], [-160, 1, 6.8, 9.0], [-170, -1, 7.0, 9.5], [-172, 1, 7.2, 9.0],
    ]) spots.push({ z, side, off, h });
    for (let k = 0; k < 26; k++) spots.push({ z: -100 - r() * 90, side: r() < 0.5 ? -1 : 1, off: 12 + r() * 40, h: 7 + r() * 5 });
    for (let k = 0; k < 46; k++) spots.push({ z: 14 - r() * 125, side: r() < 0.5 ? -1 : 1, off: 16 + r() * 34, h: 7 + r() * 5 });
    for (const s of spots) {
      const x = trailX(s.z) + s.side * s.off;
      const t = broadleaf(r, { h: s.h, spread: 1.9 + r() * 1.2 + s.h * 0.08, clusters: 4 + Math.floor(r() * 3), cardSize: 1.7, density: 0.9 });
      const m = M(x, this.groundAt(x, s.z) - 0.1, s.z, 0, r() * TAU, 0, 0.92 + r() * 0.25);
      trunks.take(t.trunk, m);
      leaves.push(t.leaves.applyMatrix4(m));
      proxies.push(t.proxy.applyMatrix4(m));
      this.footprints.push({ x, z: s.z, hx: 0.8, hz: 0.8 });
    }
    const bark = new THREE.Mesh(trunks.build('bark'), this.mats.bark);
    bark.castShadow = true;
    bark.receiveShadow = true;
    bark.renderOrder = 3;
    this.scene.add(bark);
    // canopy shadows come from opaque stand-ins that draw nothing on screen
    const pm = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const proxy = new THREE.Mesh(mergeGeometries(proxies), pm);
    proxy.castShadow = true;
    proxy.renderOrder = 99;
    this.scene.add(proxy);
    this.shadowOnly = [proxy];
    const lm = new THREE.Mesh(mergeGeometries(leaves), this.foliage('leaves', { map: this.tex.leaves, wind: 'leaves', windAmt: 1, trans: [0.75, 0.05], edgeFade: true }));
    lm.renderOrder = 3;
    this.scene.add(lm);
    this.buildBushes();
  }

  foliage(key, o) {
    const { map = null, wind = 'grass', windAmt = 0.35, tipH = 0.6, trans = [0.9, 0.06], cells = null, fade = null, colors = true, skyK = 1, edgeFade = false } = o;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      uWind: { value: windAmt }, uTipH: { value: tipH }, uTrans: { value: new THREE.Vector2(...trans) },
      uFade: { value: new THREE.Vector2(...(fade || [0, 0])) }, uCellScale: { value: new THREE.Vector2(...(cells || [1, 1])) },
      uSkyK: { value: skyK },
    }]);
    Object.assign(uniforms, HAZE_U, { uT: this.timeU, uMap: { value: map }, uSH: this.shU });
    const defines = { ['WIND_' + wind.toUpperCase()]: '' };
    if (map) defines.USE_CARD = '';
    if (cells) defines.USE_CELL = '';
    if (fade) defines.CARD_FADE = '';
    if (edgeFade) defines.EDGE_FADE = '';
    const mat = new THREE.ShaderMaterial({
      uniforms, defines, vertexShader: FOLIAGE_VERT, fragmentShader: FOLIAGE_FRAG,
      lights: true, vertexColors: colors, side: THREE.DoubleSide, alphaToCoverage: !!map,
    });
    mat.customProgramCacheKey = () => 'foliage:' + Object.keys(defines).sort().join(',');
    mat.name = key;
    return mat;
  }

  /** Shrubs along the house fronts (clear of the doors), round the square and by the stream. */
  buildBushes() {
    const r = rng(88);
    const parts = [];
    const put = (x, z, rad, h) => {
      const g = bush(r, { rad, h });
      g.applyMatrix4(M(x, this.groundAt(x, z) - 0.05, z, 0, r() * TAU, 0));
      parts.push(g);
      this.footprints.push({ x, z, hx: rad * 0.8, hz: rad * 0.8 });
    };
    for (const f of this.fronts) {
      if (f.back) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const z = f.z + (r() - 0.5) * f.w * 0.95;
        if (f.door && Math.abs(z - f.door.z) < 1.4) continue;
        const x = f.x - f.side * (0.5 + r() * 0.35);
        if (this.blocked(x, z, true)) continue;
        put(x, z, 0.45 + r() * 0.3, 0.6 + r() * 0.5);
      }
    }
    for (let k = 0; k < 16; k++) {
      const x = XR + (r() < 0.5 ? -1 : 1) * (4 + r() * 16);
      const z = streamZ(x) + (r() < 0.5 ? -1 : 1) * (STREAM.half + 1.2 + r() * 1.5);
      put(x, z, 0.6 + r() * 0.4, 0.8 + r() * 0.5);
    }
    const m = new THREE.Mesh(mergeGeometries(parts), this.foliage('bushes', { map: this.tex.hedge, wind: 'leaves', windAmt: 0.5, trans: [0.6, 0.05], edgeFade: true }));
    m.renderOrder = 3;
    this.scene.add(m);
  }

  // ------------------------------------------------------------------ grass and flowers
  buildGrass() {
    const r = rng(23);
    const clump = makeClump(rng(5), 11);
    const mat = this.foliage('grass', { wind: 'grass', windAmt: 0.35, tipH: 0.5, trans: [0.55, 0.05] });
    const greens = ['#5a8a34', '#4f7d30', '#668f3a', '#4a7434', '#76944a', '#87924e', '#5c843a', '#6e8a3c'].map(C);
    // near the ride only: geometric blades in 4 m chunks (both sides of the road in one draw), shown while they're
    // big on screen
    this.grassChunks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const CH = 4;
    for (let z0 = 4; z0 > -76; z0 -= CH) {
      const items = [];
      for (const side of [-1, 1]) {
        const cell = 0.42;
        for (let zz = z0; zz > z0 - CH + 1e-6; zz -= cell) {
          for (let a = 2.7; a < 9.5; a += cell) {
            const off = a + r() * cell, z = zz - r() * cell;
            const x = trailX(z) + side * off;
            // in the village the roadside is trodden earth with clumps of grass; lush outside it and by the stream
            const village = smoothstep(-1, -6, z) * (1 - smoothstep(-102, -110, z)) * smoothstep(STREAM.half + 4, STREAM.half + 8, Math.abs(z - streamZ(x)));
            const patch = smoothstep(-0.05, 0.3, fbm(x * 0.22 + 7, z * 0.22 - 3, 3)) + smoothstep(5.0, 7.0, off);
            const dens = (off < 3.2 ? 0.25 : off < 4.6 ? 0.75 : 0.6) * (1 - village * (1 - Math.min(1, patch) * 0.8));
            if (r() > dens || this.blocked(x, z)) continue;
            items.push({ x, z, off });
          }
        }
      }
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(clump, mat, items.length);
      items.forEach((it, i) => {
        p.set(it.x, this.groundAt(it.x, it.z) - 0.02, it.z);
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.15, r() * TAU, (r() - 0.5) * 0.15));
        const sc = (0.7 + r() * 0.45) * (it.off > 4 ? 1.1 : 0.9);
        s.set(sc, sc * (0.85 + r() * 0.4), sc);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, greens[Math.floor(r() * greens.length)].clone().multiplyScalar(0.85 + r() * 0.3));
      });
      mesh.computeBoundingSphere();
      mesh.renderOrder = 1;
      mesh.userData = { z0, z1: z0 - CH };
      this.scene.add(mesh);
      this.grassChunks.push(mesh);
    }
    this.buildGrassCards();
    this.buildFlowers();
  }

  /** Further off, tufts are single cards facing the ride (the camera always looks down -z), in 4 m chunks. */
  buildGrassCards() {
    const r = rng(29);
    const card = new THREE.PlaneGeometry(1.1, 0.55);
    card.translate(0, 0.25, 0);
    const nrm = card.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const mat = this.foliage('grasscards', { map: this.tex.grassCards, windAmt: 0.3, tipH: 0.5, trans: [0.45, 0.04], cells: [1, 0.5], fade: [16, 22], colors: false });
    this.cardChunks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let z0 = -8; z0 > -120; z0 -= 4) {
      const items = [];
      for (let k = 0; k < 140 && items.length < 40; k++) {
        const z = z0 - r() * 4, side = r() < 0.5 ? -1 : 1;
        const off = 2.8 + Math.pow(r(), 1.2) * 12;
        const x = trailX(z) + side * off;
        if (this.blocked(x, z)) continue;
        items.push({ x, z });
      }
      if (!items.length) continue;
      const g = card.clone();
      const cells = new Float32Array(items.length * 2);
      const mesh = new THREE.InstancedMesh(g, mat, items.length);
      items.forEach((it, i) => {
        p.set(it.x, this.groundAt(it.x, it.z) - 0.03, it.z);
        q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.5, 0));
        const sc = 0.7 + r() * 0.6;
        s.set(sc * (r() < 0.5 ? -1 : 1), sc * (0.8 + r() * 0.5), sc);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, new THREE.Color(0.85, 0.85, 0.8).multiplyScalar(0.75 + r() * 0.3));
        cells[i * 2 + 1] = r() < 0.8 ? 0 : 0.5;
      });
      g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
      mesh.computeBoundingSphere();
      mesh.renderOrder = 1;
      mesh.userData = { z0, z1: z0 - 4 };
      this.scene.add(mesh);
      this.cardChunks.push(mesh);
    }
  }

  buildFlowers() {
    const r = rng(99);
    const a = new THREE.PlaneGeometry(0.42, 0.42);
    a.translate(0, 0.21, 0);
    const b = a.clone().rotateY(Math.PI / 2);
    const card = mergeGeometries([a, b]);
    const nrm = card.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const N = 420;
    const cells = new Float32Array(N * 2);
    const mesh = new THREE.InstancedMesh(card, this.foliage('flowers', { map: this.tex.flowers, windAmt: 0.25, tipH: 0.4, trans: [0.45, 0.04], cells: [0.5, 0.5], fade: [0, 0.01], colors: false }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let k = 0; k < N * 4 && n < N; k++) {
      const z = 6 - r() * 100, side = r() < 0.5 ? -1 : 1;
      const off = 2.8 + Math.pow(r(), 1.4) * 9;
      const x = trailX(z) + side * off;
      if (this.blocked(x, z)) continue;
      if (fbm(x * 0.3 + 4, z * 0.3, 2) < -0.05) continue;
      p.set(x, this.groundAt(x, z) - 0.02, z);
      q.setFromEuler(new THREE.Euler(0, r() * TAU, 0));
      const sc = 0.65 + r() * 0.6;
      s.set(sc, sc, sc);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n, m4);
      const u = r();
      const kind = u < 0.42 ? 0 : u < 0.78 ? 1 : u < 0.88 ? 2 : 3;
      cells[n * 2] = (kind % 2) * 0.5; cells[n * 2 + 1] = Math.floor(kind / 2) * 0.5;
      mesh.setColorAt(n, new THREE.Color().setScalar(0.85 + r() * 0.3));
      n++;
    }
    mesh.count = n;
    card.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    mesh.computeBoundingSphere();
    mesh.renderOrder = 1;
    this.scene.add(mesh);
  }

  /** Is (x, z) taken (a building, prop, the road, the stream)? */
  blocked(x, z, allowRoadside = false) {
    if (Math.abs(x - trailX(z)) < 2.7 && !allowRoadside) return true;
    if (Math.abs(z - streamZ(x)) < STREAM.half + 0.5 || pondD(x, z) < 0.5) return true;
    const dx = x - trailX(z);
    if (z < SQUARE.z1 && z > SQUARE.z0 && dx < SQUARE.x1 && dx > SQUARE.x0) return true;
    return this.footprints.some((f) => !f.stream && Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz);
  }

  // ------------------------------------------------------------------ smoke, glows, motes
  buildSmoke() {
    const chim = this.chimneys || [];
    const K = 7;
    const n = chim.length * K;
    if (!n) return;
    const quadG = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quadG.index;
    g.setAttribute('position', quadG.attributes.position);
    g.setAttribute('uv', quadG.attributes.uv);
    const org = new Float32Array(n * 3), ph = new Float32Array(n);
    const r = rng(61);
    chim.forEach((c, i) => {
      for (let k = 0; k < K; k++) {
        const j = i * K + k;
        org[j * 3] = c.x; org[j * 3 + 1] = c.y; org[j * 3 + 2] = c.z;
        ph[j] = k / K + r() * 0.04 + i * 0.37;
      }
    });
    g.setAttribute('aOrg', new THREE.InstancedBufferAttribute(org, 3));
    g.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    g.instanceCount = n;
    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: { ...HAZE_U, uT: this.timeU, uMap: { value: this.tex.smoke }, uSun: { value: this.sunDir } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uT; uniform vec3 uSun; attribute vec3 aOrg; attribute float aPh; varying vec2 vUv; varying float vA; varying vec3 vCol; varying vec4 vHaze;
        ${HAZE_COMMON}
        void main() {
          float a = fract(uT * 0.085 + aPh);
          vec3 c = aOrg + vec3(a * 2.6 + sin(a * 5.0 + aPh * 30.0) * 0.25, a * 5.5, a * 1.6);
          float size = 0.55 + a * 2.2;
          vec4 mv = viewMatrix * vec4(c, 1.0);
          float rot = aPh * 20.0 + a * 1.5;
          vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
          mv.xy += q * size;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vA = smoothstep(0.0, 0.1, a) * (1.0 - a) * 0.5;
          vec3 V = normalize(c - cameraPosition);
          float toward = pow(max(dot(V, uSun), 0.0), 3.0);
          vCol = mix(vec3(0.42, 0.42, 0.48), vec3(0.95, 0.78, 0.6), 0.25 + 0.6 * toward);
          vHaze = hazeAt(c);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying vec3 vCol; varying vec4 vHaze;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          gl_FragColor = vec4(mix(vCol * t.r, vHaze.rgb, vHaze.a), t.a * vA);
        }`,
    });
    const m = new THREE.Mesh(g, this.smokeMat);
    m.frustumCulled = false;
    m.renderOrder = 5;
    this.scene.add(m);
  }

  buildGlows() {
    // soft halos round the lanterns (additive)
    const pts = [...this.lamps.map((l) => l.glass), ...this.marks];
    if (!pts.length) return;
    const quadG = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quadG.index;
    g.setAttribute('position', quadG.attributes.position);
    g.setAttribute('uv', quadG.attributes.uv);
    const org = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => org.set([p.x, p.y, p.z], i * 3));
    g.setAttribute('aOrg', new THREE.InstancedBufferAttribute(org, 3));
    g.instanceCount = pts.length;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.tex.glow }, uSize: { value: 0.95 }, uGain: { value: 0.3 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aOrg; uniform float uSize; varying vec2 vUv; varying float vFade;
        void main() {
          vec4 mv = viewMatrix * vec4(aOrg, 1.0); mv.xy += position.xy * uSize; mv.z += 0.3; gl_Position = projectionMatrix * mv; vUv = uv;
          float dist = length(aOrg - cameraPosition);
          vFade = exp(-dist * 0.012) * smoothstep(3.0, 9.0, dist);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uGain; varying vec2 vUv; varying float vFade;
        void main() { float a = texture2D(uMap, vUv).a; gl_FragColor = vec4(vec3(1.0, 0.68, 0.34) * a * uGain * vFade, 1.0); }`,
    });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 6;
    this.scene.add(m);
  }

  buildMotes() {
    // pollen and dust drifting in the low sun
    const N = 170;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3), ph = new Float32Array(N);
    const r = rng(21);
    for (let i = 0; i < N; i++) {
      p.set([(r() - 0.5) * 18, r() * 5.0, -r() * 26], i * 3);
      ph[i] = r() * TAU;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uScale: { value: 1 }, uSunDir: { value: this.sunDir } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uT, uScale; uniform vec3 uSunDir; attribute float phase; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uT * 0.08 + sin(uT * 0.5 + phase) * 0.2, 5.0) + 0.3;
          p.x += sin(uT * 0.4 + phase) * 0.5;
          p.z += cos(uT * 0.3 + phase * 2.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (1.6 + 1.4 * fract(phase * 7.0)) * (8.0 / max(-mv.z, 1.0));
          vec3 V = normalize((modelMatrix * vec4(p, 1.0)).xyz - cameraPosition);
          vA = (0.15 + 0.85 * pow(max(dot(V, uSunDir), 0.0), 3.0)) * (0.6 + 0.4 * sin(uT * 1.7 + phase * 5.0));
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a * vA * 0.7, 1.0); }
      `,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
    this.moteMat = mat;
  }

  // ------------------------------------------------------------------ per frame
  update(t, post) {
    this.t = t;
    const { pos, quat } = this.camPose(t);
    this.camera.position.copy(pos);
    this.camera.quaternion.copy(quat);
    this.camera.updateMatrixWorld();
    this.sky.position.copy(pos);
    this.timeU.value = t;
    if (this.shadowOnly && !this.sun.shadow.needsUpdate) for (const o of this.shadowOnly) o.visible = false;
    if (this.waterMat?.normalMap) this.waterMat.normalMap.offset.set(t * 0.012, t * 0.03);
    for (const [i, g] of (this.markMeshes || []).entries()) {
      // face the camera (upright), bob gently
      g.position.y = g.userData.y + 0.1 * Math.sin(t * 2.4 + i * 1.7);
      g.rotation.set(0, Math.atan2(pos.x - g.position.x, pos.z - g.position.z) + 0.25 * Math.sin(t * 1.3 + i), 0);
    }
    if (this.moteMat) {
      this.moteMat.uniforms.uT.value = t;
      this.moteMat.uniforms.uScale.value = this.camera.projectionMatrix.elements[5] * 0.5 * this.renderH / 960;
      this.motes.position.set(pos.x, 0, pos.z - 4);
    }
    // grass blades only where they are big on screen; cards take over further off
    const ahead = (c, a, b) => pos.z - c.userData.z1 > a && pos.z - c.userData.z0 < b;
    for (const c of this.grassChunks) c.visible = ahead(c, 5, 24);
    for (const c of this.cardChunks) c.visible = ahead(c, 17, 64);

    post.bloom = 0.5;
    post.bloomRadius = 0.6;
    post.bloomThreshold = 0.82;
    post.vignette = 0.28;
    post.grain = 0.022;
    post.exposure = 1.0;
    post.saturation = 1.16;
    post.contrast = 1.06;
  }
}

// ---------------------------------------------------------------------- helpers
function propBatch(fn, ...args) {
  const b = new Batch();
  fn(b, new THREE.Matrix4(), ...args);
  return b;
}

/** A clump of grass blades: tapered, curved strips (2 segments), darker at the root, normals up-ish. */
function makeClump(r, blades) {
  const pos = [], nor = [], col = [], uv = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const rad = Math.sqrt(r()) * 0.19, a = r() * TAU;
    const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad;
    const h = 0.2 + Math.pow(r(), 1.3) * 0.42, w = 0.026 + r() * 0.022;
    const face = r() * TAU, fx = Math.cos(face), fz = Math.sin(face);
    const bend = (0.15 + r() * 0.35) * h;
    const nx = -fz, nz = fx;
    const n = new THREE.Vector3(fx * 0.5, 0.75, fz * 0.5).normalize();
    const b0 = pos.length / 3;
    [0, 0.55, 1].forEach((t, li) => {
      const y = t * h * (1 - 0.15 * t * t);
      const off = bend * t * t;
      const cx = bx + fx * off, cz = bz + fz * off;
      const shade = 0.32 + 0.68 * Math.pow(t, 0.8);
      if (li < 2) {
        const ww = w * (1 - t * 0.7);
        pos.push(cx - nx * ww / 2, y, cz - nz * ww / 2, cx + nx * ww / 2, y, cz + nz * ww / 2);
        nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
        col.push(shade, shade, shade * 0.95, shade, shade, shade * 0.95);
        uv.push(0, t, 1, t);
      } else {
        pos.push(cx, y, cz);
        nor.push(n.x, n.y, n.z);
        col.push(shade * 1.05, shade * 1.05, shade * 0.9);
        uv.push(0.5, 1);
      }
    });
    idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2, b0 + 2, b0 + 3, b0 + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
