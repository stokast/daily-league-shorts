// The render page's engine and controls. It waits for the project to be ready, draws every frame on this
// computer's GPU, encodes the frames with the browser's own H.264 encoder (WebCodecs), adds the soundtrack that
// was prepared with the bundle (already AAC) and writes an MP4, then offers it to save. Nothing is installed:
// it all runs inside this browser tab. No dependencies.
import { muxMP4 } from './mp4.js';
import { parseADTS } from './adts.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`;
const clock = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.max(0, Math.round(s))} s`);

// a yield that background-tab timer throttling doesn't slow down
const channel = new MessageChannel();
let wake = null;
channel.port1.onmessage = () => wake && wake();
const tick = () => new Promise((r) => { wake = r; channel.port2.postMessage(0); });

const manifest = await (await fetch(new URL('./manifest.json', import.meta.url))).json();
const ui = {
  status: $('gr-status'), detail: $('gr-detail'), gpu: $('gr-gpu'), encoder: $('gr-encoder'),
  render: $('gr-render'), test: $('gr-test'), cancel: $('gr-cancel'), bar: $('gr-bar'), progress: $('gr-progress'),
  result: $('gr-result'), resultText: $('gr-result-text'), save: $('gr-save'), stage: $('gr-stage'), note: $('gr-note'),
};
const state = { phase: 'loading', target: null, encoder: null, cancel: false, result: null };
window.gpuRenderState = state; // for automated tests

function setStatus(text, tone = 'neutral') {
  ui.status.textContent = text;
  ui.status.dataset.tone = tone;
}
function fail(message) {
  state.phase = 'error';
  setStatus(message, 'bad');
  ui.render.disabled = true;
  ui.test.disabled = true;
}

// ---- the project's errors would otherwise be silent
window.addEventListener('error', (e) => { if (state.phase === 'loading') fail(`The project failed to load: ${e.message}`); });
window.addEventListener('unhandledrejection', (e) => {
  if (state.phase === 'loading') fail(`The project failed to load: ${e.reason?.message || e.reason}`);
});

// ---- loading progress: how much of the project has arrived
let files = 0, bytes = 0;
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) { files++; bytes += e.transferSize || e.encodedBodySize || 0; }
    if (state.phase === 'loading') ui.detail.textContent = `${files} files, ${mb(bytes)} loaded`;
  }).observe({ type: 'resource', buffered: true });
} catch { /* no resource timing: the status line just says loading */ }

// ---- the downloads capability (claude.ai's save prompt), asked for early: it can take a moment to answer
const downloads = (async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') return await window.claude.use('downloads');
  } catch { /* not available here */ }
  return null;
})();

/** The project, once it's ready: {width, height, fps, duration, canvas, draw(t)}. */
function findTarget() {
  const g = window.gpuRender;
  if (g && g.canvas && typeof g.draw === 'function') return g;
  // projects that expose `window.ad = {W, H, fps, duration, render(t)}` and set `window.ready` (the Spawn ad)
  const ad = window.ad;
  if (window.ready === true && ad && typeof ad.render === 'function') {
    const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return { width: ad.W, height: ad.H, fps: ad.fps, duration: ad.duration, canvas, draw: (t) => ad.render(t), ready: true };
  }
  return null;
}

async function pickEncoder(width, height, fps, bitrate) {
  if (typeof VideoEncoder === 'undefined') return null;
  const codecs = ['avc1.640033', 'avc1.640034', 'avc1.640032', 'avc1.64002A', 'avc1.640028', 'avc1.4D4033', 'avc1.4D4028', 'avc1.42E033', 'avc1.42E028'];
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {
    for (const codec of codecs) {
      const config = { codec, width, height, bitrate, framerate: fps, hardwareAcceleration: hw, latencyMode: 'quality', bitrateMode: 'variable', avc: { format: 'avc' } };
      try {
        const s = await VideoEncoder.isConfigSupported(config);
        if (s.supported) return { config, hardware: hw === 'prefer-hardware' };
      } catch { /* try the next */ }
    }
  }
  return null;
}

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : 'no WebGL';
  } catch { return 'unknown'; }
}

const PROFILES = { 64: 'High', '4D': 'Main', 42: 'Baseline' };

async function init() {
  setStatus('Loading the project…');
  let target = null;
  const started = performance.now();
  while (!target) {
    if (state.phase === 'error') return;
    target = findTarget();
    if (target && target.ready && typeof target.ready.then === 'function') await target.ready;
    else if (target && target.ready === false) target = null;
    if (!target) await sleep(100);
    if (performance.now() - started > 180000 && !target) return fail('The project did not become ready within 3 minutes.');
  }
  const T = {
    width: manifest.width || target.width || target.canvas.width,
    height: manifest.height || target.height || target.canvas.height,
    fps: manifest.fps || target.fps || 30,
    duration: manifest.duration || target.duration,
    canvas: target.canvas,
    draw: target.draw.bind(target),
  };
  if (!T.duration) return fail('The project does not say how long it is (duration).');
  T.frames = Math.round(T.duration * T.fps);
  state.target = T;
  // the preview: the project's own canvas, scaled down (its drawing size doesn't change)
  T.canvas.classList.add('gr-canvas');
  ui.stage.replaceChildren(T.canvas);
  ui.stage.style.aspectRatio = `${T.width} / ${T.height}`;
  await T.draw(Math.min(T.duration * 0.3, T.duration - 1 / T.fps));

  ui.gpu.textContent = gpuName();
  const bitrate = manifest.bitrate || Math.round(T.width * T.height * T.fps * 0.62);
  const enc = await pickEncoder(T.width, T.height, T.fps, bitrate);
  if (!enc) {
    ui.encoder.textContent = 'none';
    return fail('This browser cannot encode H.264 video. Open this page in Chrome or Edge.');
  }
  state.encoder = enc;
  const profile = PROFILES[enc.config.codec.slice(5, 7).toUpperCase()] || enc.config.codec;
  ui.encoder.textContent = `H.264 ${profile}, ${enc.hardware ? 'GPU (hardware)' : 'CPU (software)'}, ${(bitrate / 1e6).toFixed(0)} Mbit/s`;
  state.phase = 'ready';
  setStatus('Ready', 'good');
  ui.detail.textContent = `${files} files, ${mb(bytes)} loaded`;
  ui.render.disabled = false;
  ui.test.disabled = false;
}

let audioCache = null;
async function loadAudio() {
  if (!manifest.audio) return null;
  if (!audioCache) {
    const buf = new Uint8Array(await (await fetch(new URL(manifest.audio, document.baseURI))).arrayBuffer());
    audioCache = parseADTS(buf);
  }
  return audioCache;
}

/** Render frames [from, to) and return the MP4 as a Blob. */
async function render(from, to) {
  const T = state.target;
  const N = to - from;
  const ts = 90000 % T.fps === 0 ? 90000 : T.fps * 1000;
  const frameTicks = ts / T.fps;
  const usPerFrame = 1e6 / T.fps;
  const samples = [];
  let decoderConfig = null;
  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta && meta.decoderConfig) decoderConfig = meta.decoderConfig;
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, pts: Math.round((chunk.timestamp * ts) / 1e6), dur: frameTicks, key: chunk.type === 'key' });
    },
    error: (e) => { encodeError = e; },
  });
  encoder.configure(state.encoder.config);
  const keyEvery = Math.round(T.fps);
  const t0 = performance.now();
  let lock = null;
  try { lock = await navigator.wakeLock?.request('screen'); } catch { /* fine without */ }
  try {
    for (let k = 0; k < N; k++) {
      if (state.cancel) throw new Error('cancelled');
      if (encodeError) throw encodeError;
      await T.draw((from + k) / T.fps);
      const frame = new VideoFrame(T.canvas, { timestamp: Math.round(k * usPerFrame), duration: Math.round(usPerFrame) });
      encoder.encode(frame, { keyFrame: k % keyEvery === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6) {
        await new Promise((r) => { encoder.addEventListener('dequeue', r, { once: true }); setTimeout(r, 40); });
      }
      if (k % 2 === 0 || k === N - 1) {
        const el = (performance.now() - t0) / 1000;
        const rate = (k + 1) / el;
        ui.bar.value = (k + 1) / N;
        ui.progress.textContent = `Frame ${k + 1} of ${N} · ${rate.toFixed(1)} frames/s · ${clock((N - k - 1) / rate)} left`;
        await tick();
      }
    }
    ui.progress.textContent = 'Finishing the encode…';
    await encoder.flush();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
    lock?.release().catch(() => {});
  }
  if (encodeError) throw encodeError;
  if (!decoderConfig || !decoderConfig.description) throw new Error('the encoder gave no H.264 configuration');

  // the soundtrack's frames for this stretch (the AAC encoder's priming samples are trimmed by an edit list)
  let audio = null;
  const A = await loadAudio();
  if (A) {
    const priming = manifest.audioPriming ?? 1024;
    const s0 = priming + Math.round((from / T.fps) * A.sampleRate);
    const s1 = priming + Math.round((to / T.fps) * A.sampleRate);
    // keep the frame before the first one heard: AAC frames overlap, so a decoder needs it to rebuild the start
    const first = Math.max(0, Math.floor(s0 / 1024) - 1);
    const last = Math.min(A.frames.length, Math.ceil(s1 / 1024));
    audio = { sampleRate: A.sampleRate, channels: A.channels, asc: A.asc, frames: A.frames.slice(first, last), skip: s0 - first * 1024, bitrate: manifest.audioBitrate };
  }
  ui.progress.textContent = 'Writing the MP4…';
  await tick();
  const mp4 = muxMP4({
    video: {
      width: T.width, height: T.height, timescale: ts, samples,
      avcC: new Uint8Array(decoderConfig.description instanceof ArrayBuffer ? decoderConfig.description : decoderConfig.description.buffer.slice(decoderConfig.description.byteOffset, decoderConfig.description.byteOffset + decoderConfig.description.byteLength)),
      colorSpace: decoderConfig.colorSpace,
    },
    audio,
  });
  return { blob: new Blob([mp4], { type: 'video/mp4' }), seconds: (performance.now() - t0) / 1000, frames: N };
}

async function run(seconds = null, startAt = 0) {
  const T = state.target;
  const from = Math.max(0, Math.min(T.frames - 1, Math.round(startAt * T.fps)));
  const to = seconds ? Math.min(T.frames, from + Math.round(seconds * T.fps)) : T.frames;
  state.phase = 'rendering';
  state.cancel = false;
  state.result = null;
  ui.render.disabled = true;
  ui.test.disabled = true;
  ui.cancel.hidden = false;
  ui.result.hidden = true;
  ui.bar.hidden = false;
  ui.bar.value = 0;
  setStatus(seconds ? `Test render: the first ${seconds} s` : 'Rendering', 'busy');
  try {
    const out = await render(from, to);
    const name = seconds ? manifest.output.replace(/\.mp4$/, `-test-${seconds}s.mp4`) : manifest.output;
    state.result = { ...out, name };
    window.gpuRenderResult = state.result;
    state.phase = 'done';
    setStatus('Done', 'good');
    ui.progress.textContent = `${out.frames} frames in ${clock(out.seconds)} (${(out.frames / out.seconds).toFixed(1)} frames/s)`;
    ui.resultText.textContent = `${name} · ${mb(out.blob.size)}`;
    ui.result.hidden = false;
    ui.save.disabled = false;
    ui.save.textContent = 'Save video';
  } catch (e) {
    if (e.message === 'cancelled') { setStatus('Stopped', 'neutral'); ui.progress.textContent = 'Rendering was stopped.'; state.phase = 'ready'; }
    else { setStatus(`Rendering failed: ${e.message}`, 'bad'); state.phase = 'ready'; }
  } finally {
    ui.cancel.hidden = true;
    ui.render.disabled = false;
    ui.test.disabled = false;
  }
}

async function save() {
  const r = state.result;
  if (!r) return;
  ui.save.disabled = true;
  const api = await downloads;
  if (api) {
    try {
      await api.save({ filename: r.name, data: r.blob });
      ui.save.textContent = 'Saved';
    } catch (e) {
      const why = {
        declined: 'Not saved: the save was declined.',
        too_large: 'This file is too large to save here.',
        rate_limited: 'A save prompt is already open. Try again in a moment.',
      }[e && e.code] || `Could not save: ${(e && e.message) || e}`;
      ui.note.textContent = why;
      ui.save.disabled = false;
    }
    return;
  }
  // outside claude.ai's viewer (opened on its own, or a local test): an ordinary download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.blob);
  a.download = r.name;
  document.body.append(a);
  a.click();
  a.remove();
  ui.save.textContent = 'Saved';
}

ui.render.addEventListener('click', () => run());
ui.test.addEventListener('click', () => run(manifest.testSeconds || 3));
ui.cancel.addEventListener('click', () => { state.cancel = true; });
ui.save.addEventListener('click', save);
window.gpuRenderStart = (seconds, startAt) => run(seconds, startAt); // for automated tests
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'rendering') ui.note.textContent = 'Keep this tab in front while it renders: browsers slow down hidden tabs.';
});

init().catch((e) => fail(`Could not start: ${e.message}`));
