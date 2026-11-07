// Page bootstrap: renderer, post chain, and the time -> frame function the render driver calls.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { loadFonts } from './fonts.js';
import * as TL from './timeline.js';
import { Overlay } from './overlay.js';
import { FinalShader } from './post.js';
import { Tunnel } from './tunnel.js';
import { World } from './world.js';
import { Panels } from './panels.js';
import { clamp, smoothstep, invLerp, easeInCubic, easeOutCubic, easeInExpo } from './util.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920);

await loadFonts();

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const blank = new THREE.Scene();
blank.background = new THREE.Color(0x000000);
const blankCam = new THREE.PerspectiveCamera();
const renderPass = new RenderPass(blank, blankCam);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.5, 0.8);
composer.addPass(bloom);
const final = new ShaderPass(FinalShader);
final.uniforms.uRes.value.set(W, H);
composer.addPass(final);

const overlay = new Overlay(W, H);
final.uniforms.tOverlay.value = overlay.texture;
const tunnel = new Tunnel(W, H);
const world = new World(W, H);
const panels = new Panels(W, H, world, overlay);
await panels.init();

const U = final.uniforms;

function postDefaults() {
  return {
    radial: 0, ca: 0, swirl: 0, shrink: 0, pinch: 0, ovSwirl: 0, ovShrink: 0, point: 0, flash: 0, sceneGain: 1,
    vignette: 0.3, grain: 0.03, exposure: 1, saturation: 1, contrast: 1, bloom: 0.8, bloomRadius: 0.5, bloomThreshold: 0.8,
  };
}

/** Set the whole frame up for time t. */
function setTime(t) {
  const post = postDefaults();
  let scene = blank, camera = blankCam;

  if (t >= TL.IN.approach[0] && t < TL.IN.flash) {
    tunnel.update(t, post);
    scene = tunnel.scene; camera = tunnel.camera;
  } else if (t >= TL.IN.flash && t < TL.OUT.flash) {
    world.update(t, post);
    panels.update(t, post);
    scene = world.scene; camera = world.camera;
  } else if (t >= TL.OUT.flash && t < TL.OUT.recede[1]) {
    tunnel.update(t, post);
    scene = tunnel.scene; camera = tunnel.camera;
  }

  // ---- transitions
  // opening: the typed line swirls into a point
  const suck = invLerp(TL.IN.suck[0], TL.IN.suck[1], t);
  if (t >= TL.IN.suck[0] && t < TL.IN.approach[1]) {
    post.ovSwirl = 0.9 * easeInCubic(suck);
    post.ovShrink = easeInCubic(suck);
  }
  // the point: grows as the text collapses, hands over to the cable end as we dive in
  post.point = Math.max(post.point,
    smoothstep(TL.IN.suck[0] + 0.1, TL.IN.suck[1], t) * (1 - smoothstep(TL.IN.approach[0] + 0.12, TL.IN.approach[0] + 0.42, t)));
  // into the world: white burst
  if (t >= TL.IN.flash - 0.16 && t < TL.IN.flash + 0.6) {
    post.flash = t < TL.IN.flash ? easeInExpo(invLerp(TL.IN.flash - 0.16, TL.IN.flash, t)) : Math.pow(1 - invLerp(TL.IN.flash, TL.IN.flash + 0.5, t), 2.2);
  }
  // exit: world + bar swirl into the centre, white burst, back through the cable
  if (t >= TL.OUT.vortex[0] && t < TL.OUT.flash) {
    const v = invLerp(TL.OUT.vortex[0], TL.OUT.vortex[1], t);
    post.swirl = 1.6 * easeInCubic(v);
    post.pinch = easeInCubic(v) * 1.6;
    post.radial = Math.max(post.radial, 1.0 * easeInCubic(v));
    post.ca = Math.max(post.ca, 0.8 * easeInCubic(v));
    post.point = Math.max(post.point, smoothstep(0.45, 1, v));
    post.flash = Math.max(post.flash, easeInExpo(invLerp(TL.OUT.vortex[1] - 0.12, TL.OUT.vortex[1], t)));
  }
  if (t >= TL.OUT.flash && t < TL.OUT.flash + 0.5) post.flash = Math.max(post.flash, 1 - easeOutCubic(invLerp(TL.OUT.flash, TL.OUT.flash + 0.45, t)));
  // the cable end shrinks into the point that becomes the cursor
  if (t >= TL.OUT.recede[0] && t < TL.END.cursorAt + 0.3) {
    post.point = Math.max(post.point, smoothstep(TL.OUT.recede[0] + 0.15, TL.OUT.recede[1], t) * (1 - smoothstep(TL.END.cursorAt, TL.END.cursorAt + 0.25, t)));
  }

  renderPass.scene = scene;
  renderPass.camera = camera;
  bloom.strength = post.bloom;
  bloom.radius = post.bloomRadius;
  bloom.threshold = post.bloomThreshold;

  if (overlay.draw(t)) overlay.texture.needsUpdate = true;

  U.uTime.value = t;
  U.uRadial.value = post.radial;
  U.uCA.value = post.ca;
  U.uSwirl.value = post.swirl;
  U.uShrink.value = post.shrink;
  U.uPinch.value = post.pinch;
  U.uOvSwirl.value = post.ovSwirl;
  U.uOvShrink.value = post.ovShrink;
  U.uPoint.value = post.point;
  U.uFlash.value = post.flash;
  U.uSceneGain.value = post.sceneGain;
  U.uVignette.value = post.vignette;
  U.uGrain.value = post.grain;
  U.uExposure.value = post.exposure;
  U.uSaturation.value = post.saturation;
  U.uContrast.value = post.contrast;
}

const gl = renderer.getContext();
let pixels = null;
window.ad = {
  W, H, fps: TL.FPS, duration: TL.DURATION,
  render(t) { setTime(t); composer.render(); },
  /** Render t and return raw RGBA (bottom-up rows). */
  grab(t) {
    setTime(t);
    composer.render();
    if (!pixels) pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  },
  /** Render frames [from, to) and POST each to the driver's /frame endpoint. */
  async renderRange(from, to, step, url) {
    for (let i = from; i < to; i += step) {
      const px = this.grab(i / TL.FPS);
      const res = await fetch(`${url}?i=${i}`, { method: 'POST', body: px });
      if (!res.ok) throw new Error('frame post failed ' + i);
    }
    return true;
  },
};
window.ready = true;
