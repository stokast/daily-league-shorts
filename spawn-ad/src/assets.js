// Loads the village's CC0 assets, fetched into /assets by tools/fetch-assets.mjs (sources and licences in
// tools/assets.json): the baked sky (sharp window, panorama, lighting HDR and its numbers), PBR texture sets
// from Poly Haven, a few Poly Haven props as glTF, and ambientCG's leaf scans.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const BASE = '/assets/';

/** Texture sets by use: Poly Haven id, resolution, real-world tile size (m), how sharp at grazing angles. */
export const SETS = {
  road: { id: 'cobblestone_floor_04', res: '2k', size: 1.5, aniso: 4 },
  grass: { id: 'forrest_ground_01', res: '1k', size: 2, aniso: 2 },
  verge: { id: 'grass_path_2', res: '1k', size: 1.4, aniso: 2 },
  plaster: { id: 'plastered_wall', res: '1k', size: 2 },
  timber: { id: 'rough_wood', res: '1k', size: 0.8 },
  planks: { id: 'weathered_planks', res: '1k', size: 2 },
  brick: { id: 'castle_brick_01', res: '1k', size: 1.5 },
  stone: { id: 'stone_wall', res: '1k', size: 2.4 },
  ashlar: { id: 'large_sandstone_blocks_01', res: '1k', size: 3 },
  clay: { id: 'clay_roof_tiles_02', res: '1k', size: 2.5, aniso: 2 },
  slate: { id: 'grey_roof_tiles_02', res: '1k', size: 1.6, aniso: 2 },
  thatch: { id: 'thatch_roof_angled', res: '1k', size: 1.1, aniso: 2 },
  bark: { id: 'bark_brown_02', res: '1k', size: 1 },
};

export const MODELS = {
  barrel: 'wine_barrel_01',
  crate: 'wooden_crate_02',
  bucket: 'wooden_bucket_01',
  shield: 'kite_shield',
};

const texLoader = new THREE.TextureLoader();
function tex(url, srgb, { aniso = 1, repeat = true } = {}) {
  return texLoader.loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  });
}
function img(url) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('could not load ' + url + ' (run node tools/fetch-assets.mjs)'));
    i.src = url;
  });
}

async function loadSet(s) {
  const dir = `${BASE}textures/${s.id}/${s.id}`;
  const [map, normal, rough] = await Promise.all([
    tex(`${dir}_diff_${s.res}.jpg`, true, s),
    tex(`${dir}_nor_gl_${s.res}.jpg`, false, s),
    tex(`${dir}_rough_${s.res}.jpg`, false, s),
  ]);
  return { map, normal, rough, size: s.size };
}

export async function loadAssets() {
  const sky = await (await fetch(`${BASE}sky/sky.json`)).json().catch(() => {
    throw new Error('assets missing: run node tools/fetch-assets.mjs');
  });
  const gltf = new GLTFLoader();
  const [win, pano, light, sets, models, leafColor, leafOpacity] = await Promise.all([
    tex(`${BASE}sky/${sky.window.file}`, true, { repeat: false }),
    tex(`${BASE}sky/${sky.pano.file}`, true, { repeat: false }),
    new RGBELoader().setDataType(THREE.HalfFloatType).loadAsync(`${BASE}sky/${sky.light.file}`),
    Promise.all(Object.entries(SETS).map(async ([k, s]) => [k, await loadSet(s)])).then(Object.fromEntries),
    Promise.all(Object.entries(MODELS).map(async ([k, id]) => [k, (await gltf.loadAsync(`${BASE}models/${id}/${id}_1k.gltf`)).scene])).then(Object.fromEntries),
    img(`${BASE}atlases/LeafSet024/LeafSet024_1K-JPG_Color.jpg`),
    img(`${BASE}atlases/LeafSet024/LeafSet024_1K-JPG_Opacity.jpg`),
  ]);
  win.wrapS = THREE.ClampToEdgeWrapping;
  win.wrapT = THREE.ClampToEdgeWrapping;
  pano.wrapS = THREE.RepeatWrapping;
  light.mapping = THREE.EquirectangularReflectionMapping;
  return { sky: { meta: sky, window: win, pano, light }, sets, models, leaves: { color: leafColor, opacity: leafOpacity } };
}
