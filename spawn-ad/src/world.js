// The game world: after the cable you walk a dirt trail through a fantasy village at golden hour,
// looking up at the sky where the games you prompt appear. Textured, sun-lit and hazy, in the manner of
// a modern MMO village: half-timbered cottages, lanterns, market stall, well, banners, leafy trees,
// lush grass, castle and mountains fading into a peach haze. Textures come from src/textures.js,
// buildings and props from src/village.js.
//
// Performance notes (SwiftShader, no GPU): every rasterized fragment is shaded (no early-z), so what
// counts is screen area x shader cost and thin triangles. Haze and foliage lighting are per vertex,
// shadows use a cheap 4-tap filter on one static shadow map, grass blades exist only near the walk.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { W0, OUT } from './timeline.js';
import { clamp, smoothstep, invLerp, easeInCubic, rng, fbm, hash, TAU } from './util.js';
import { makeTextures, CLOUD_MAP } from './textures.js';
import {
  Batch, M, cottage, PALETTE, lampPost, fence, barrel, crate, sack, stall, well, cart, bannerPole, woodpile, bench,
  broadleaf, bush, box, cyl, paint,
} from './village.js';

const C = (hex) => new THREE.Color(hex); // sRGB hex -> linear working colour

const WALK_SPEED = 1.25; // metres per second: an easy stroll
const EYE = 1.7;
const PITCH = 10; // degrees up: looking at the sky
const Z_START = 3.0;
/** The trail's centre line. */
import { trailX, cameraBase, cameraPose } from './ride.js';
export { trailX };

// The sun: low, ahead and to the left (azimuth from straight ahead (-z), negative = left; degrees).
const SUN_AZ = -40, SUN_EL = 12;
const azEl = (az, el) => {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};
const SUN_DIR = azEl(SUN_AZ, SUN_EL);
const CASTLE = { x: 16, z: -560 };

// ---------------------------------------------------------------------------------------- haze
// Aerial perspective shared by every material: height fog integrated along the view ray, its colour
// warm toward the sun and lilac away from it, evaluated per vertex. The sky's horizon uses the same
// colour, so far land dissolves into it.
const HAZE_U = {
  uSunDir: { value: SUN_DIR.clone() },
  uHazeWarm: { value: C('#ffcf9a') },
  uHazeCool: { value: C('#d9bccb') },
  uHazeSun: { value: C('#ffd6a0') },
  uHazeK: { value: new THREE.Vector3(0.003, 1 / 60, 1) }, // density at y=0, height falloff, max amount
};
const HAZE_COMMON = /* glsl */ `
uniform vec3 uSunDir, uHazeWarm, uHazeCool, uHazeSun;
uniform vec3 uHazeK;
vec3 hazeColor(vec3 V) {
  float sd = max(dot(V, uSunDir), 0.0);
  float s2 = sd * sd, s4 = s2 * s2;
  float az = dot(normalize(V.xz + vec2(1e-5)), normalize(uSunDir.xz)) * 0.5 + 0.5;
  return mix(uHazeCool, uHazeWarm, az * az) + uHazeSun * (s4 * s4 * s2) * 0.35;
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

/**
 * Give a built-in material the shared haze, the cheaper shadow filter, and optional extra shader edits.
 * Materials without extra edits share one cache key, so three can reuse a compiled program between
 * materials with the same features (compiling is slow under SwiftShader).
 */
function haze(mat, key, extra) {
  if (!extra) key = 'common';
  mat.fog = false;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, HAZE_U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHazeW; varying vec4 vHaze;\n' + HAZE_COMMON)
      .replace('#include <project_vertex>', HAZE_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHazeW; varying vec4 vHaze;')
      .replace('#include <shadowmap_pars_fragment>', SHADOW_PARS)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vHaze.rgb, vHaze.a);');
    if (extra) extra(sh);
  };
  mat.customProgramCacheKey = () => 'haze:' + key;
  return mat;
}

// ---------------------------------------------------------------------------------------- foliage
// Grass, flowers and leaves: Lambert lighting, light through the blades when backlit, a 4-tap shadow
// and the haze, all per vertex (blades are thin and leaf cards overlap a lot, so the fragment shader
// must be nearly free).
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
#ifdef USE_CELL
attribute vec2 aCell;
#endif
varying vec3 vLight, vCol;
varying vec2 vUv;
varying vec4 vHaze;
varying float vFade;
${HAZE_COMMON}
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
  vec3 vn = normalize(mat3(viewMatrix) * wn);
  float sh = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  sh = shadowAt(directionalShadowMatrix[0] * vec4(wp.xyz + wn * directionalLightShadows[0].shadowNormalBias, 1.0),
                directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias);
  #endif
  vec3 sun = vec3(0.0), L = vec3(0.0, 1.0, 0.0);
  #if NUM_DIR_LIGHTS > 0
  sun = directionalLights[0].color * sh;
  L = directionalLights[0].direction;
  #endif
  vec3 irr = sun * max(dot(vn, L), 0.0) + ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
  irr += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, 0.5 * dot(vn, hemisphereLights[0].direction) + 0.5);
  #endif
  float back = max(dot(normalize(mv.xyz), L), 0.0);
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
varying vec3 vLight, vCol;
varying vec2 vUv;
varying vec4 vHaze;
varying float vFade;
void main() {
  vec4 c = vec4(vCol, 1.0);
  #ifdef USE_CARD
  c *= texture2D(uMap, vUv);
  #ifdef CARD_FADE
  c.a *= vFade;
  #endif
  c.a = smoothstep(0.5, 0.5 + fwidth(c.a), c.a);
  if (c.a <= 0.0) discard;
  #endif
  vec3 col = mix(c.rgb * vLight, vHaze.rgb, vHaze.a);
  gl_FragColor = vec4(col, c.a);
}
`;
function foliage(key, timeU, { map = null, wind = 'grass', windAmt = 0.35, tipH = 0.6, trans = [0.9, 0.06], cells = null, fade = null, colors = true } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
    uWind: { value: windAmt }, uTipH: { value: tipH }, uTrans: { value: new THREE.Vector2(...trans) },
    uFade: { value: new THREE.Vector2(...(fade || [0, 0])) }, uCellScale: { value: new THREE.Vector2(...(cells || [1, 1])) },
  }]);
  Object.assign(uniforms, HAZE_U, { uT: timeU, uMap: { value: map } });
  const defines = { ['WIND_' + wind.toUpperCase()]: '' };
  if (map) defines.USE_CARD = '';
  if (cells) defines.USE_CELL = '';
  if (fade) defines.CARD_FADE = '';
  const mat = new THREE.ShaderMaterial({
    uniforms, defines, vertexShader: FOLIAGE_VERT, fragmentShader: FOLIAGE_FRAG,
    lights: true, vertexColors: colors, side: THREE.DoubleSide, alphaToCoverage: !!map,
  });
  mat.customProgramCacheKey = () => 'foliage:' + Object.keys(defines).sort().join(',');
  mat.name = key;
  return mat;
}

export class World {
  constructor(W, H) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, W / H, 0.25, 6000);
    this.t = 0;
    this.renderH = H;
    this.timeU = { value: 0 };
    this.tex = makeTextures({ sunAz: SUN_AZ, sunEl: SUN_EL });
    this.mats = this.makeMaterials();
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildFar();
    this.buildVillage();
    this.buildTrees();
    this.buildGrass();
    this.buildSmoke();
    this.buildGlows();
    this.buildMotes();
  }

  // ------------------------------------------------------------------ camera
  /** Where the walk is at time t (the title screens follow this). */
  /** The camera's base pose (the ride decides it: third person behind the rider; see ride.js). */
  basePose(t) {
    return cameraBase(t);
  }

  /** Camera pose at time t: the smooth follow, plus the lunge into the vortex at the end. */
  camPose(t) {
    return cameraPose(t);
  }

  groundAt(x, z) {
    const a = Math.abs(x - trailX(z));
    // the verge stands a little above the worn trail; gentle bumps further out
    let h = smoothstep(0.85, 1.5, a) * 0.07;
    h += fbm(x * 0.05, z * 0.05, 3) * 0.55 * smoothstep(2.5, 9, a);
    // meadows rise away from the village, then rolling hills
    h += smoothstep(16, 80, a) * 3.5;
    const r = Math.hypot(x, z + 30);
    h += Math.max(0, fbm(x * 0.0075 + 3, z * 0.0075 - 2, 4) + 0.18) * 48 * smoothstep(70, 260, r);
    // the castle's hill
    h += 50 * Math.exp(-((x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2) / (120 * 120));
    // mountains far off
    const d = Math.hypot(x * 0.8, z + 30);
    if (d > 600) {
      const rid = 1 - Math.abs(fbm(x * 0.0016 + 7, z * 0.0016 + 1, 5));
      h += smoothstep(650, 1500, d) * (Math.pow(rid, 2.4) * 300 + 25);
    }
    return h;
  }

  // ------------------------------------------------------------------ materials
  makeMaterials() {
    const T = this.tex;
    // every solid surface has a map and a normal map (white / flat where it has none), so they all
    // compile to one shader program
    const std = (key, o) => haze(new THREE.MeshStandardMaterial({ vertexColors: true, map: T.flat.map, normalMap: T.flat.normal, ...o }), key);
    const basic = (key, o) => haze(new THREE.MeshBasicMaterial({ vertexColors: true, ...o }), key);
    return {
      plaster: std('plaster', { map: T.plaster.map, normalMap: T.plaster.normal, roughness: 0.93 }),
      timber: std('timber', { map: T.timber.map, normalMap: T.timber.normal, roughness: 0.82, normalScale: new THREE.Vector2(0.6, 0.6) }),
      roof: std('roof', { map: T.shingles.map, normalMap: T.shingles.normal, roughness: 0.78, normalScale: new THREE.Vector2(1.25, 1.25) }),
      stone: std('stone', { map: T.stone.map, normalMap: T.stone.normal, roughness: 0.88 }),
      wood: std('wood', { map: T.planks.map, normalMap: T.planks.normal, roughness: 0.84 }),
      bark: std('bark', { map: T.bark.map, normalMap: T.bark.normal, roughness: 0.92 }),
      iron: std('iron', { roughness: 0.45, metalness: 0.0 }),
      plain: std('plain', { roughness: 0.7 }),
      sign: std('sign', { map: T.signs, roughness: 0.8 }),
      awning: this.cloth(T.awning, 0),
      glass: basic('glass', { map: T.window }),
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
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.y = 1.0 - vMapUv.y;')
        .replace('// @wind', `{
          float hang = 1.0 - uv.y;
          float k = (0.25 + uv.x) * (0.3 + hang) * uAmp;
          hzW.x += sin(uT * 2.2 + uv.y * 3.0 + hzW.z) * 0.07 * k;
          hzW.z += sin(uT * 2.9 + uv.y * 4.0 + uv.x * 2.0 + hzW.x) * 0.16 * k;
        }`);
    });
    return mat;
  }

  // ------------------------------------------------------------------ sky
  buildSky() {
    this.skyU = {
      ...HAZE_U,
      uZen: { value: C('#6276bd') },
      uMid: { value: C('#a7a2d2') },
      uLow: { value: C('#f3c6b0') },
      uClouds: { value: this.tex.clouds },
      uCloudMap: { value: new THREE.Vector4(CLOUD_MAP.az0, CLOUD_MAP.az1, CLOUD_MAP.el0, CLOUD_MAP.el1) },
      uDrift: { value: 0 },
    };
    // a dome from just below the horizon up: the land always covers what is lower
    const dome = new THREE.SphereGeometry(4000, 96, 40, 0, TAU, 0, THREE.MathUtils.degToRad(93));
    const sky = new THREE.Mesh(dome, new THREE.ShaderMaterial({
      uniforms: this.skyU,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform vec3 uSunDir, uHazeWarm, uHazeCool, uHazeSun, uZen, uMid, uLow;
        varying vec3 vDir, vSky; varying vec2 vAzEl;
        void main() {
          vec3 d = normalize(position);
          vDir = d;
          vAzEl = vec2(degrees(atan(d.x, -d.z)), degrees(asin(clamp(d.y, -1.0, 1.0))));
          // the gradient and the broad glow round the sun, per vertex
          float h = d.y;
          float sd = max(dot(d, uSunDir), 0.0);
          float s2 = sd * sd, s4 = s2 * s2, s8 = s4 * s4;
          float az = dot(normalize(d.xz + vec2(1e-5)), normalize(uSunDir.xz)) * 0.5 + 0.5;
          vec3 hor = mix(uHazeCool, uHazeWarm, az * az) + uHazeSun * (s8 * s2) * 0.35;
          vec3 col = mix(hor, uLow, smoothstep(0.0, 0.17, h));
          col = mix(col, uMid, smoothstep(0.1, 0.45, h));
          col = mix(col, uZen, smoothstep(0.4, 1.0, h));
          vSky = col + uHazeSun * (s4 * sd * 0.12);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir, uHazeSun;
        uniform sampler2D uClouds;
        uniform vec4 uCloudMap;
        uniform float uDrift;
        varying vec3 vDir, vSky; varying vec2 vAzEl;
        void main() {
          vec3 col = vSky;
          float sd = max(dot(normalize(vDir), uSunDir), 0.0);
          if (sd > 0.85) {
            float s2 = sd * sd, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8;
            col += uHazeSun * (s16 * s16 * s8 * 0.28);
            col += vec3(1.0, 0.93, 0.8) * smoothstep(0.99975, 0.99988, sd) * 2.5;
          }
          vec2 uv = vec2((vAzEl.x - uCloudMap.x) / (uCloudMap.y - uCloudMap.x) + uDrift, (uCloudMap.z - vAzEl.y) / (uCloudMap.z - uCloudMap.w));
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
            vec4 c = texture2D(uClouds, uv);
            col = mix(col, c.rgb, c.a);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    sky.frustumCulled = false;
    sky.renderOrder = 100;
    this.sky = sky;
    this.scene.add(sky);
  }

  // ------------------------------------------------------------------ light
  buildLights() {
    this.hemi = new THREE.HemisphereLight(C('#b0b6e6'), C('#a08560'), 1.45);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(C('#ffbf80'), 3.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    // nothing that casts a shadow moves much: one static map over the whole walk corridor
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    const z = SUN_DIR.clone();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
    const y = z.clone().cross(x);
    const c0 = new THREE.Vector3(-0.5, 0, -40);
    const ext = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
    for (const px of [-17, 17]) for (const py of [-1, 13]) for (const pz of [-46, 46]) {
      const p = new THREE.Vector3(px, py, pz);
      for (const [k, ax] of [['x', x], ['y', y], ['z', z]]) { const v = p.dot(ax); ext[k][0] = Math.min(ext[k][0], v); ext[k][1] = Math.max(ext[k][1], v); }
    }
    const D = 220;
    sun.target.position.copy(c0);
    sun.position.copy(c0).addScaledVector(z, D);
    const cam = sun.shadow.camera;
    cam.left = ext.x[0]; cam.right = ext.x[1]; cam.bottom = ext.y[0]; cam.top = ext.y[1];
    cam.near = D - ext.z[1] - 90;
    cam.far = D - ext.z[0] + 5;
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ land and trail
  buildTerrain() {
    const T = this.tex;
    for (const t of [T.dirt.map, T.dirt.normal, T.grass.map, T.grass.normal, T.noise]) { t.minFilter = THREE.LinearMipmapNearestFilter; t.anisotropy = 1; }
    // columns follow the trail: offsets from its centre line, fine near the trail, coarse far out
    const cols = [0];
    for (let s = 0.2; s <= 2.2; s += 0.2) cols.push(s);
    for (let s = 2.2, ds = 0.3; s < 95; ds *= 1.12) { s += ds; cols.push(Math.min(s, 95)); }
    const S = [...cols.slice(1).map((v) => -v).reverse(), ...cols];
    const rows = [];
    for (let z = 16; z > -95; z -= 0.5) rows.push(z);
    for (let z = -95, dz = 0.5; z > -170; dz *= 1.06) { z -= dz; rows.push(Math.max(z, -170)); }
    const nc = S.length, nr = rows.length;
    const pos = new Float32Array(nc * nr * 3), col = new Float32Array(nc * nr * 3);
    const c = new THREE.Color(), warm = new THREE.Color(1.15, 1.08, 0.75), cool = new THREE.Color(0.78, 0.88, 0.8), white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < nr; i++) {
      const z = rows[i], tx = trailX(z);
      for (let j = 0; j < nc; j++) {
        const x = tx + S[j];
        const k = i * nc + j;
        pos[k * 3] = x; pos[k * 3 + 1] = this.groundAt(x, z); pos[k * 3 + 2] = z;
        // broad colour variation in the grass, none on the trail
        const a = Math.abs(S[j]);
        const n1 = fbm(x * 0.06 + 11, z * 0.06 - 3, 3), n2 = fbm(x * 0.2, z * 0.2, 2);
        c.copy(white).lerp(warm, clamp(n1 * 1.4)).lerp(cool, clamp(-n1 * 1.4)).multiplyScalar(0.92 + n2 * 0.16);
        c.lerp(white, 1 - smoothstep(1.0, 2.5, a));
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
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    haze(mat, 'ground', (sh) => {
      Object.assign(sh.uniforms, {
        uDirt: { value: T.dirt.map }, uDirtN: { value: T.dirt.normal }, uGrass: { value: T.grass.map }, uGrassN: { value: T.grass.normal },
        uNoise: { value: T.noise }, uTrail: { value: new THREE.Vector4(1.1, 0.055, 0.5, -0.45) },
      });
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uDirt, uDirtN, uGrass, uGrassN, uNoise; uniform vec4 uTrail; float gDirt;')
        .replace('#include <map_fragment>', /* glsl */ `{
          vec2 wp = vHazeW.xz;
          float dx = wp.x - (uTrail.x * sin(wp.y * uTrail.y + uTrail.z) + uTrail.w);
          vec4 nz = vec4(0.5);
          if (abs(dx) < 2.2) nz = texture2D(uNoise, wp * 0.09);
          float ad = abs(dx) + (nz.r - 0.5) * 0.6 + (nz.g - 0.5) * 0.3;
          gDirt = 1.0 - smoothstep(0.8, 1.1, ad);
          vec3 dc = vec3(0.0), gc = vec3(0.0);
          if (ad < 1.75) {
            dc = texture2D(uDirt, wp * 0.25).rgb;
            float rut = exp(-pow((abs(dx) - 0.47) / 0.13, 2.0));
            dc *= (1.0 - rut * 0.15) * (0.9 + 0.2 * nz.g);
          }
          if (gDirt < 0.999) {
            gc = texture2D(uGrass, wp * 0.5).rgb;
            float verge = smoothstep(0.7, 1.05, ad) * (1.0 - smoothstep(1.05, 1.7, ad));
            gc = mix(gc, dc * vec3(0.85, 0.95, 0.75), verge * 0.4);
          }
          diffuseColor.rgb *= mix(gc, dc, gDirt);
        }`)
        .replace('#include <normal_fragment_maps>', /* glsl */ `
          if (vHaze.a < 0.12 && length(vHazeW - cameraPosition) < 32.0) {
            vec2 wp = vHazeW.xz;
            vec3 nd = vec3(0.0, 0.0, 1.0), ng = vec3(0.0, 0.0, 1.0);
            if (gDirt > 0.001) nd = texture2D(uDirtN, wp * 0.25).xyz * 2.0 - 1.0;
            if (gDirt < 0.999) ng = texture2D(uGrassN, wp * 0.5).xyz * 2.0 - 1.0;
            vec3 mn = normalize(mix(ng, nd, gDirt));
            vec3 T = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
            vec3 Bt = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
            T = normalize(T - normal * dot(normal, T));
            Bt = normalize(Bt - normal * dot(normal, Bt) - T * dot(T, Bt));
            normal = normalize(mat3(T, Bt, normal) * mn);
          }`);
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.renderOrder = 4;
    this.scene.add(m);
    this.terrain = m;
  }

  /** Hills, the castle's hill and the mountains: a polar grid round the village, vertex coloured. */
  buildFar() {
    const O = new THREE.Vector2(0, -12);
    const A0 = THREE.MathUtils.degToRad(-42), A1 = THREE.MathUtils.degToRad(42);
    const na = 124, rings = [];
    for (let r = 90; r < 4200; r *= 1.065) rings.push(r);
    const nr = rings.length;
    const pos = new Float32Array(na * nr * 3), col = new Float32Array(na * nr * 3);
    const c = new THREE.Color();
    const meadow = C('#7f9a4a'), dry = C('#b4a25e'), forest = C('#2f4a2c'), rockC = C('#8a7f78'), snow = C('#fff0e4');
    for (let i = 0; i < nr; i++) {
      const r = rings[i];
      for (let j = 0; j < na; j++) {
        const a = A0 + (A1 - A0) * (j / (na - 1));
        const x = O.x + Math.sin(a) * r, z = O.y - Math.cos(a) * r;
        let h = this.groundAt(x, z);
        // sink below the near terrain where both exist
        const sNear = Math.abs(x - trailX(z));
        h -= (1 - smoothstep(85, 100, sNear)) * smoothstep(-175, -160, z) * 4;
        const k = (i * na + j) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        const n = fbm(x * 0.01 + 5, z * 0.01, 4), n2 = fbm(x * 0.04, z * 0.04, 2);
        c.copy(meadow).lerp(dry, clamp(0.5 + n * 1.2)).multiplyScalar(0.9 + n2 * 0.2);
        c.lerp(forest, smoothstep(0.05, 0.25, fbm(x * 0.006 - 4, z * 0.006 + 9, 4)) * (1 - smoothstep(150, 260, h)) * smoothstep(150, 320, r));
        c.lerp(rockC, smoothstep(90, 200, h) * 0.85);
        c.lerp(snow, smoothstep(205, 270, h + n * 30));
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
    const m = new THREE.Mesh(mergeGeometries([g, this.forestGeometry()]), haze(new THREE.MeshLambertMaterial({ vertexColors: true }), 'far'));
    m.renderOrder = 5;
    this.scene.add(m);
    this.buildCastle();
  }

  buildCastle() {
    const B = new Batch();
    const gy = this.groundAt(CASTLE.x, CASTLE.z);
    const stone = new THREE.Color(1, 0.97, 0.94);
    const roofC = C('#4f6290');
    const add = (key, g, x, y, z) => B.add(key, g, M(x, y, z));
    // curtain wall and towers
    const R = 22;
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU, a1 = ((k + 1) / 6) * TAU;
      const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      const len = Math.hypot(x1 - x0, z1 - z0);
      B.add('stone', box(len, 9, 2.4, stone), M((x0 + x1) / 2, 4.5, (z0 + z1) / 2, 0, -Math.atan2(z1 - z0, x1 - x0), 0));
      add('stone', cyl(3.2, 3.6, 14, 16, stone), x0, 7, z0);
      add('roof', cyl(0, 4.1, 6.5, 16, roofC), x0, 17.2, z0);
    }
    // the keep and its spires
    add('stone', box(14, 26, 12, stone), 0, 13, 0);
    const kr = new THREE.ConeGeometry(10.5, 9, 4, 1);
    kr.rotateY(Math.PI / 4);
    kr.scale(1, 1, 0.86);
    B.add('roof', paint(kr, roofC), M(0, 30.5, 0));
    for (const [x, z, h] of [[-7, -6, 36], [7, 6, 32], [6, -6, 40]]) {
      add('stone', cyl(2.4, 2.6, h, 16, stone), x, h / 2, z);
      add('roof', cyl(0, 3.1, 9, 16, roofC), x, h + 4.5, z);
    }
    for (let k = 0; k < 18; k++) {
      if (hash(k, 3) < 0.45) continue;
      add('glow', box(0.9, 1.5, 0.3, C('#ffb860').multiplyScalar(1.4)), -5 + (k % 6) * 2, 12 + Math.floor(k / 6) * 5, 6.1);
    }
    const mtx = M(CASTLE.x, gy - 4, CASTLE.z, 0, 0.35, 0);
    glowUV(B.parts.glow);
    for (const key of ['stone', 'roof', 'glow']) {
      const g = B.build(key);
      g.applyMatrix4(mtx);
      const mat = key === 'glow' ? this.mats.glass : key === 'roof' ? this.mats.roof : this.mats.stone;
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 5;
      this.scene.add(m);
    }
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
    const green = C('#40683a');
    for (let tries = 0; tries < 20000 && out.length < 240; tries++) {
      const a = (r() - 0.5) * 1.15, d = 120 + Math.pow(r(), 0.7) * 900;
      const x = Math.sin(a) * d, z = -12 - Math.cos(a) * d;
      if (fbm(x * 0.006 - 4, z * 0.006 + 9, 4) < 0.08 && r() < 0.85) continue;
      const h = this.groundAt(x, z);
      if (h > 170) continue;
      if (Math.abs(x - CASTLE.x) < 30 && Math.abs(z - CASTLE.z) < 30) continue;
      const sc = 3 + r() * 3.5;
      const g = paint(base.clone(), green.clone().multiplyScalar(0.75 + r() * 0.5));
      g.deleteAttribute('uv');
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * TAU, 0)), new THREE.Vector3(sc, sc * (1 + r() * 0.4), sc)));
      out.push(g);
    }
    return mergeGeometries(out);
  }

  // ------------------------------------------------------------------ the village
  buildVillage() {
    const r = rng(41);
    const B = new Batch();
    this.chimneys = [];
    this.lamps = [];
    this.footprints = [];
    const place = (x, z, ry, y = null) => M(x, y ?? this.groundAt(x, z), z, 0, ry, 0);

    // houses on both sides, fronts facing the trail: [z, side, floors, ridge along the street, extra].
    // The left side (toward the low sun) keeps wide gaps, a square and a garden, so sunlight crosses the trail.
    const HOUSES = [
      [-2, -1, 2, true], [-18, -1, 1, false, { sign: 2, awning: true }], [-43, -1, 2, false], [-51.5, -1, 1, true, { sign: 3 }],
      [-69, -1, 2, true], [-78, -1, 1, false], [-87, -1, 2, true],
      [-6.5, 1, 1, true], [-14.5, 1, 2, false, { sign: 1 }], [-29.5, 1, 2, true], [-38.5, 1, 2, true, { w: 8.2, sign: 0, awning: true }],
      [-49, 1, 1, false], [-58, 1, 2, true], [-67, 1, 2, false], [-76.5, 1, 1, true], [-85.5, 1, 2, true],
    ];
    for (const [z, side, floors, along, extra = {}] of HOUSES) {
      const w = extra.w ?? 5.4 + r() * 1.5, d = 4.6 + r() * 1.0;
      const set = 4.7 + r() * 1.1;
      const o = {
        w, d, floors, ridgeAlongX: !!along, pitch: THREE.MathUtils.degToRad(46 + r() * 8),
        groundStone: r() < 0.3, wall: PALETTE.walls[Math.floor(r() * PALETTE.walls.length)],
        roof: PALETTE.roofs[Math.floor(r() * PALETTE.roofs.length)], shutter: r() < 0.6 ? PALETTE.shutters[Math.floor(r() * PALETTE.shutters.length)] : null,
        doorColor: new THREE.Color().setHSL(0.07 + r() * 0.05, 0.3 + r() * 0.2, 0.55 + r() * 0.2), ...extra,
      };
      // the back and the far end never face the walk: skip their framing and windows
      o.hidden = new Set(['back', side < 0 ? 'right' : 'left']);
      const hs = cottage(r, o);
      const x = trailX(z) + side * (set + d / 2 + (floors > 1 ? 0.35 : 0));
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const mtx = place(x, z, ry, this.groundAt(x, z) - 0.05);
      B.take(hs.B, mtx);
      if (hs.anchors.smoke) this.chimneys.push(hs.anchors.smoke.clone().applyMatrix4(mtx));
      for (const l of hs.anchors.lamps) this.lamps.push(l.clone().applyMatrix4(mtx));
      this.footprints.push({ x, z, hx: d / 2 + 0.9, hz: w / 2 + 0.6 });
      (this.fronts ||= []).push({ x: x - side * (d / 2 + (floors > 1 ? 0.35 : 0)), z, w, side, door: hs.anchors.door ? hs.anchors.door.pos.clone().applyMatrix4(mtx) : null });
    }

    // lanterns along the trail, alternating sides, arms reaching over the trail
    for (let k = 0; k < 14; k++) {
      const z = -1.5 - k * 6.5, side = k % 2 ? 1 : -1;
      const x = trailX(z) + side * 1.6;
      this.lamps.push(lampPost(B, place(x, z, side < 0 ? 0 : Math.PI), r));
    }
    // fences round the gardens on the left and along some fronts
    for (const [z0, z1, side, off] of [[-5.5, -14.5, -1, 3.1], [-55.5, -64.5, -1, 3.2], [1.5, -3.5, 1, 3.1], [-52.5, -55, 1, 3.0], [-22, -26, -1, 3.0]]) {
      for (let z = z0; z > z1 + 0.5; z -= 1.6) {
        const za = z, zb = Math.max(z - 1.6, z1);
        const xa = trailX(za) + side * off, xb = trailX(zb) + side * off;
        const len = Math.hypot(xb - xa, zb - za);
        const ang = Math.atan2(-(zb - za), xb - xa);
        B.take(fenceBatch(len, r), place((xa + xb) / 2, (za + zb) / 2, ang));
      }
    }
    // market stall, well, cart, woodpiles, benches
    const st = { z: -22.5, side: 1 };
    B.take(propBatch(stall, r), place(trailX(st.z) + 4.3, st.z, -Math.PI / 2));
    this.footprints.push({ x: trailX(st.z) + 4.3, z: st.z, hx: 1.3, hz: 2.4 });
    B.take(propBatch(well, r), place(trailX(-29.5) - 4.8, -29.5, 0.3));
    this.footprints.push({ x: trailX(-29.5) - 4.8, z: -29.5, hx: 1.6, hz: 1.6 });
    B.take(propBatch(cart, r), place(trailX(-9.5) - 4.2, -9.5, 0.45));
    this.footprints.push({ x: trailX(-9.5) - 4.2, z: -9.5, hx: 1.4, hz: 1.8 });
    B.take(propBatch(bench, r), place(trailX(-34) - 3.2, -34, Math.PI / 2));
    B.take(propBatch(bench, r), place(trailX(-61) - 3.6, -61, Math.PI / 2));
    // barrels, crates and sacks by the houses and round the square
    for (let k = 0; k < 22; k++) {
      const z = -2 - r() * 72, side = r() < 0.5 ? -1 : 1;
      const x = trailX(z) + side * (3.4 + r() * 1.1);
      const kind = r();
      const fn = kind < 0.45 ? barrel : kind < 0.8 ? crate : sack;
      B.take(propBatch(fn, r), place(x, z, r() * TAU));
      if (r() < 0.4) B.take(propBatch(fn === barrel ? crate : barrel, r), place(x + 0.35, z + (r() < 0.5 ? 0.75 : -0.75), r() * TAU));
    }
    // rocks along the verges
    // banners on poles
    this.banners = [];
    for (const [z, side] of [[-16.8, 1], [-31.5, -1], [-45.5, 1], [-60, -1]]) {
      const x = trailX(z) + side * 2.25;
      B.take(propBatch(bannerPole, r), place(x, z, side < 0 ? 0 : Math.PI));
      this.banners.push({ x, y: this.groundAt(x, z), z, side });
    }
    // woodpiles against a few houses
    for (const [z, side] of [[-8.8, 1], [-43.5, 1], [-46.5, -1]]) {
      const x = trailX(z) + side * 5.3;
      B.take(propBatch(woodpile, r), place(x, z, side < 0 ? Math.PI / 2 : -Math.PI / 2));
    }

    // merge by material
    const groups = {
      plaster: ['plaster'], timber: ['timber'], roof: ['roof'], stone: ['stone'], wood: ['wood'], bark: ['bark'], iron: ['iron'],
      plain: ['flowers3d', 'produce', 'cloth3d'], sign: ['sign'], awning: ['awning'], glass: ['glass', 'darkglass', 'glow'],
    };
    glowUV(B.parts.glow);
    for (const g of B.parts.awning || []) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
    for (const [mat, keys] of Object.entries(groups)) {
      const parts = keys.flatMap((k) => B.parts[k] || []);
      if (!parts.length) continue;
      const tmp = new Batch();
      tmp.parts[keys[0]] = parts;
      const mesh = new THREE.Mesh(tmp.build(keys[0]), this.mats[mat]);
      mesh.renderOrder = 2;
      mesh.castShadow = ['plaster', 'stone', 'roof', 'wood', 'bark'].includes(mat);
      mesh.receiveShadow = mat !== 'glass';
      this.scene.add(mesh);
    }
    this.buildBanners();
  }

  buildBanners() {
    const geos = [];
    for (const b of this.banners) {
      const g = new THREE.PlaneGeometry(0.8, 1.7, 6, 10);
      g.translate(0.45, 3.9 - 0.85, 0);
      if (b.side > 0) g.rotateY(Math.PI);
      g.translate(b.x, b.y, b.z);
      geos.push(g);
    }
    const mat = this.cloth(this.tex.banner, 1);
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = true;
    m.renderOrder = 2;
    this.scene.add(m);
  }

  // ------------------------------------------------------------------ trees
  buildTrees() {
    const r = rng(73);
    const trunks = new Batch();
    const leaves = [], proxies = [];
    const spots = [];
    // big trees in the square, the garden and the meadow, and a few between the houses on the right
    for (const [z, side, off, h] of [[-34.5, -1, 9.5, 7.2], [-10.5, -1, 9, 6.2], [-61, -1, 10, 6.8], [-24.5, 1, 8.8, 6.5], [-43.5, 1, 8, 6.2], [-0.5, 1, 9, 6.5], [-71.5, 1, 9, 6.8], [-92, -1, 7, 6]]) spots.push({ z, side, off, h });
    for (let k = 0; k < 30; k++) spots.push({ z: 8 - r() * 110, side: r() < 0.5 ? -1 : 1, off: 12 + r() * 22, h: 6 + r() * 4 });
    for (const s of spots) {
      const x = trailX(s.z) + s.side * s.off;
      const t = broadleaf(r, { h: s.h, spread: 1.9 + r() * 1.1, clusters: 4 + Math.floor(r() * 3), cardSize: 1.6, density: 0.85 });
      const m = M(x, this.groundAt(x, s.z) - 0.1, s.z, 0, r() * TAU, 0, 0.9 + r() * 0.25);
      trunks.take(t.trunk, m);
      leaves.push(t.leaves.applyMatrix4(m));
      proxies.push(t.proxy.applyMatrix4(m));
    }
    const bark = new THREE.Mesh(trunks.build('bark'), this.mats.bark);
    bark.castShadow = true;
    bark.receiveShadow = true;
    bark.renderOrder = 3;
    this.scene.add(bark);
    // canopy shadows come from opaque stand-ins that draw nothing on screen
    const pm = this.mats.glass.clone();
    pm.colorWrite = false;
    pm.depthWrite = false;
    const proxy = new THREE.Mesh(mergeGeometries(proxies), pm);
    proxy.castShadow = true;
    proxy.renderOrder = 99;
    this.scene.add(proxy);
    this.shadowOnly = [proxy]; // hidden once the (static) shadow map has been drawn
    const lm = new THREE.Mesh(mergeGeometries(leaves), foliage('leaves', this.timeU, { map: this.tex.leaves, wind: 'leaves', windAmt: 1, trans: [0.8, 0.06] }));
    lm.renderOrder = 3;
    this.scene.add(lm);
    this.buildBushes();
  }

  /** Shrubs along the house fronts (clear of the doors), round the square and in the gardens. */
  buildBushes() {
    const r = rng(88);
    const parts = [];
    const put = (x, z, rad, h) => {
      const g = bush(r, { rad, h });
      g.applyMatrix4(M(x, this.groundAt(x, z) - 0.05, z, 0, r() * TAU, 0));
      parts.push(g);
      (this.footprints ||= []).push({ x, z, hx: rad * 0.8, hz: rad * 0.8 });
    };
    for (const f of this.fronts || []) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const z = f.z + (r() - 0.5) * f.w * 0.9;
        if (f.door && Math.abs(z - f.door.z) < 1.3) continue;
        put(f.x - f.side * (0.45 + r() * 0.35), z, 0.45 + r() * 0.3, 0.6 + r() * 0.5);
      }
    }
    for (const [z, side, off] of [[-26.5, -1, 6.4], [-32.5, -1, 3.6], [-8, -1, 6.5], [-12.5, -1, 3.8], [-58, -1, 4.6], [-63, -1, 6], [-20, 1, 6.2], [-44, 1, 4.4], [-3.5, -1, 3.5]]) {
      put(trailX(z) + side * off, z, 0.6 + r() * 0.35, 0.8 + r() * 0.5);
    }
    const m = new THREE.Mesh(mergeGeometries(parts), foliage('bushes', this.timeU, { map: this.tex.hedge, wind: 'leaves', windAmt: 0.5, trans: [0.6, 0.05] }));
    m.renderOrder = 3;
    this.scene.add(m);
  }

  // ------------------------------------------------------------------ grass and flowers
  buildGrass() {
    const r = rng(23);
    const clump = makeClump(rng(5), 11);
    const mat = foliage('grass', this.timeU, { wind: 'grass', windAmt: 0.35, tipH: 0.5, trans: [0.55, 0.05] });
    const greens = ['#5a8a34', '#4f7d30', '#668f3a', '#4a7434', '#76944a', '#87924e', '#5c843a', '#6e8a3c'].map(C);
    // near the walk only: geometric blades in 2 m chunks, shown while 1-20 m ahead (the bottom of the frame)
    this.grassChunks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let z0 = 1; z0 > -42; z0 -= 2) {
      for (const side of [-1, 1]) {
        const items = [];
        const cell = 0.4;
        for (let zz = z0; zz > z0 - 2 + 1e-6; zz -= cell) {
          for (let a = 0.86; a < 6.8; a += cell) {
            const off = a + r() * cell, z = zz - r() * cell;
            const x = trailX(z) + side * off;
            const dens = off < 1.0 ? 0.4 : off < 3.0 ? 1.0 : off < 5.0 ? 0.65 : 0.45;
            if (r() > dens || this.blocked(x, z)) continue;
            items.push({ x, z, off });
          }
        }
        const mesh = new THREE.InstancedMesh(clump, mat, items.length);
        items.forEach((it, i) => {
          p.set(it.x, this.groundAt(it.x, it.z) - 0.02, it.z);
          q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.15, r() * TAU, (r() - 0.5) * 0.15));
          const tall = it.off > 1.5 && it.off < 3.4 ? 1.12 : 1;
          const sc = (0.75 + r() * 0.4) * tall;
          s.set(sc, sc * (0.85 + r() * 0.4), sc);
          m4.compose(p, q, s);
          mesh.setMatrixAt(i, m4);
          mesh.setColorAt(i, greens[Math.floor(r() * greens.length)].clone().multiplyScalar(0.85 + r() * 0.3));
        });
        mesh.computeBoundingSphere();
        mesh.renderOrder = 1;
        mesh.userData = { z: z0 - 1 };
        this.scene.add(mesh);
        this.grassChunks.push(mesh);
      }
    }
    this.buildGrassCards();
    this.buildFlowers();
  }

  /** Further off, tufts are single cards facing the walk (the camera always looks down -z), in 4 m chunks. */
  buildGrassCards() {
    const r = rng(29);
    const card = new THREE.PlaneGeometry(1.1, 0.55);
    card.translate(0, 0.25, 0);
    const nrm = card.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const mat = foliage('grasscards', this.timeU, { map: this.tex.grassCards, windAmt: 0.3, tipH: 0.5, trans: [0.45, 0.04], cells: [1, 0.5], fade: [15, 20], colors: false });
    this.cardChunks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let z0 = -10; z0 > -78; z0 -= 4) {
      const items = [];
      for (let k = 0; k < 120 && items.length < 34; k++) {
        const z = z0 - r() * 4, side = r() < 0.5 ? -1 : 1;
        const off = 0.95 + Math.pow(r(), 1.3) * 7.5;
        const x = trailX(z) + side * off;
        if (this.blocked(x, z)) continue;
        items.push({ x, z });
      }
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
      mesh.userData = { z: z0 - 2 };
      this.scene.add(mesh);
      this.cardChunks.push(mesh);
    }
  }

  buildFlowers() {
    const r = rng(99);
    // two crossed cards
    const a = new THREE.PlaneGeometry(0.42, 0.42);
    a.translate(0, 0.21, 0);
    const b = a.clone().rotateY(Math.PI / 2);
    const card = mergeGeometries([a, b]);
    const nrm = card.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const N = 340;
    const cells = new Float32Array(N * 2);
    const mesh = new THREE.InstancedMesh(card, foliage('flowers', this.timeU, { map: this.tex.flowers, windAmt: 0.25, tipH: 0.4, trans: [0.45, 0.04], cells: [0.5, 0.5], fade: [0, 0.01], colors: false }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let k = 0; k < N * 3 && n < N; k++) {
      const z = 3 - r() * 66, side = r() < 0.5 ? -1 : 1;
      const off = 1.05 + Math.pow(r(), 1.5) * 6;
      const x = trailX(z) + side * off;
      if (this.blocked(x, z)) continue;
      // flowers come in drifts
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

  blocked(x, z) {
    return !!this.footprints?.some((f) => Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz);
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
      uniforms: { ...HAZE_U, uT: this.timeU, uMap: { value: this.tex.smoke } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uT; attribute vec3 aOrg; attribute float aPh; varying vec2 vUv; varying float vA; varying vec3 vCol; varying vec4 vHaze;
        ${HAZE_COMMON}
        void main() {
          float a = fract(uT * 0.085 + aPh);
          vec3 c = aOrg + vec3(a * 2.6 + sin(a * 5.0 + aPh * 30.0) * 0.25, a * 5.5, -a * 1.1);
          float size = 0.55 + a * 2.2;
          vec4 mv = viewMatrix * vec4(c, 1.0);
          float rot = aPh * 20.0 + a * 1.5;
          vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
          mv.xy += q * size;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vA = smoothstep(0.0, 0.1, a) * (1.0 - a) * 0.62;
          vec3 V = normalize(c - cameraPosition);
          float toward = pow(max(dot(V, uSunDir), 0.0), 3.0);
          vCol = mix(vec3(0.36, 0.34, 0.4), vec3(0.85, 0.66, 0.5), 0.25 + 0.6 * toward);
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
    // soft halos round the lanterns and door lamps (additive)
    const pts = this.lamps || [];
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
      uniforms: { uMap: { value: this.tex.glow }, uSize: { value: 0.75 }, uGain: { value: 0.32 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aOrg; uniform float uSize; varying vec2 vUv; varying float vFade;
        void main() {
          vec4 mv = viewMatrix * vec4(aOrg, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; vUv = uv;
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
    const N = 150;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3), ph = new Float32Array(N);
    const r = rng(21);
    for (let i = 0; i < N; i++) {
      p.set([(r() - 0.5) * 16, r() * 3.2, -r() * 22], i * 3);
      ph[i] = r() * TAU;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uScale: { value: 1 }, uSunDir: HAZE_U.uSunDir },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uT, uScale; uniform vec3 uSunDir; attribute float phase; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uT * 0.08 + sin(uT * 0.5 + phase) * 0.2, 3.2) + 0.3;
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
    this.skyU.uDrift.value = t * 0.0009;
    if (this.shadowOnly && !this.sun.shadow.needsUpdate) for (const o of this.shadowOnly) o.visible = false;
    if (this.moteMat) {
      this.moteMat.uniforms.uT.value = t;
      this.moteMat.uniforms.uScale.value = this.camera.projectionMatrix.elements[5] * 0.5 * this.renderH / 960;
      this.motes.position.set(pos.x, 0, pos.z - 2);
    }
    // grass blades only where they are big on screen; cards take over further off
    if (this.grassChunks) for (const c of this.grassChunks) { const d = pos.z - c.userData.z; c.visible = d > 1 && d < 20; }
    if (this.cardChunks) for (const c of this.cardChunks) { const d = pos.z - c.userData.z; c.visible = d > 13 && d < 58; }

    post.bloom = 0.55;
    post.bloomRadius = 0.6;
    post.bloomThreshold = 0.8;
    post.vignette = 0.3;
    post.grain = 0.025;
    post.exposure = 1.0;
    post.saturation = 1.08;
    post.contrast = 1.04;
  }
}

// ---------------------------------------------------------------------- helpers
/** Lamp glass and other glowing bits use the window material: point their uvs at a bright pane. */
function glowUV(parts = []) {
  for (const g of parts) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.62);
  }
}
function propBatch(fn, r) {
  const b = new Batch();
  fn(b, new THREE.Matrix4(), r);
  return b;
}
function fenceBatch(len, r) {
  const b = new Batch();
  fence(b, new THREE.Matrix4(), len, r);
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
