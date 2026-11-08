# GPU render in the browser

Renders a code-drawn video on the viewer's own graphics card, inside a browser tab, and saves an MP4.
The computer that renders installs nothing: no Node, npm, Python, ffmpeg or extensions, only the Chrome or
Edge it already has. It works for any project whose page can draw a given moment on demand: a WebGL or canvas
scene, like the Spawn ad in `../spawn-ad`.

## How it works

1. **Pack** (in a cloud session): `pack.mjs` runs the project once in a headless browser to see every file it
   loads. It copies exactly those files into `dist/<name>/` and adds the render runtime and the soundtrack,
   already encoded as AAC. It also writes a manifest and a publish plan.
2. **Publish** (in a cloud session, by Claude): the folder becomes a private claude.ai artifact with the
   `downloads` capability (steps below). The link is the only thing the person who renders receives.
3. **Render** (anyone with the link, in Chrome or Edge):
   1. Open the link and wait for **Ready**.
   2. Optionally, press **Test the first 3 s**.
   3. Press **Render video**, then **Save video**.

   The page draws every frame on the GPU, encodes it with the browser's own H.264 encoder (WebCodecs), copies
   in the AAC soundtrack and writes the MP4 in the tab. claude.ai then asks where to save it.

## Security model

- Rendering happens entirely inside a browser tab, in the sandbox that every website runs in. The page can't
  read or write the computer's files, start programs or install anything. The only thing written to disk is
  the MP4 the viewer accepts in claude.ai's save prompt.
- At render time the page loads nothing from other sites: only its own published files. The artifact's
  content security policy blocks other hosts anyway.
- What's inside the bundle:
  - the project's own code and assets;
  - the libraries it uses, copied from its `node_modules` when packing (for the Spawn ad: three.js and two
    font packages, the same files the cloud render runs);
  - the runtime in `runtime/`: four small files written for this tool, with no dependencies.
- Packing and testing need Playwright's Chromium and ffmpeg. They run in the cloud session, never on the
  viewer's computer.

## Project contract

The page sets `window.gpuRender` once it can draw:

```js
window.gpuRender = {
  width: 1080, height: 1920,   // the video's size (default: the canvas size)
  fps: 30,
  duration: 30,                // seconds
  canvas,                      // the canvas to record; for WebGL, create it with preserveDrawingBuffer: true
  draw(t) { /* draw the moment t (seconds) into canvas; may return a Promise */ },
  ready: promise,              // optional: resolves when everything is loaded
};
```

- Every frame must be a pure function of `t`: no real-time clocks, and no unseeded `Math.random`.
- Load files with URLs relative to the page or starting with `/` (pack rewrites `/x` to `./x`). Load nothing
  from other hosts: vendor libraries into the project (`node_modules` is fine, pack copies only the files used).
- Pages that already expose `window.ad = { W, H, fps, duration, render(t) }` and set `window.ready = true` (the
  Spawn ad) work as they are.

## Pack

```bash
node gpu-render/pack.mjs <project dir> --audio <soundtrack.wav> --name <name> --title "<Name> Render"
```

| option | default | |
|---|---|---|
| `--page` | `index.html` | the project's entry page |
| `--query` | none | query string the project expects (it is set before the project's code runs) |
| `--audio` | none | any format ffmpeg reads (encoded to AAC 256 kbit/s), or an `.aac` (ADTS) used as is |
| `--priming` | `1024` | encoder delay at the start of the AAC, trimmed with an edit list (ffmpeg's AAC encoder: 1024) |
| `--bitrate` | ~0.62 bits per pixel | video bitrate in bit/s (40000000 for 1080×1920 at 30 fps) |
| `--samples` | `12` | moments the project draws while pack watches what it loads |
| `--test-seconds` | `3` | length of the page's quick test render |
| `--out` | `gpu-render/dist/<name>` | output folder (git-ignored) |
| `--keep-css` | off | keep the project page's own `<style>` (normally dropped: the render page has its own) |

An artifact serves only some file types: pages, scripts, JSON and text, common images, fonts, and
mp3/wav/ogg/mp4/webm. Pack handles the rest:
- Text files of other types (`.gltf`, shaders) are published as `text/plain` under their own names.
- Binary files of other types (`.glb`, `.bin`, `.hdr`, the `.aac` soundtrack) are gzipped where that helps and
  written as base64 text parts. `runtime/shim.js` rebuilds each one in the page when the project fetches its
  original URL, so the project's code doesn't change.

Pack reports the bundle's size and checks it against artifact limits. Each file can be at most 15 MB (16 MB
for text), and each version 256 MB and 511 files. It also lists anything loaded from other hosts, which won't
work once published. For the Spawn ad, `npm run gpu-pack` in `spawn-ad/` packs it after `npm run audio`
(54 MB in one batch; its 14 MB horse model gzips well).

## Publish (for Claude)

`dist/<name>/publish.json` lists the batches. Publish with the Artifact tool:

1. First call:
   - `file_path`: `gpu-render/dist/<name>/index.html`
   - `root`: `gpu-render/dist/<name>`
   - `files`: the first batch, exactly as listed (a map from published path to source, where text of other
     types carries `contentType: "text/plain"`)
   - `capabilities`: `{ "downloads": true }`
   - `icon`: `"video"`
   - `description`: one sentence saying what renders.
2. Each further batch: the same `file_path` and `root`, the artifact's `url`, and that batch as `files`.
3. Give the person the link and tell them:
   - open it in Chrome or Edge on the computer with the graphics card;
   - press **Render video**;
   - keep the tab in front while it runs.

The page needs no other capability. Without `downloads` the save button can't save inside claude.ai, because
the viewer's frame blocks ordinary downloads.

## Check page

A private check page built from the demo is at https://claude.ai/artifact/7tcwdM9d8t7Ti3b8seTowE.
1. Open it in Chrome or Edge on the computer that will render.
2. Press **Render video**, then **Save video**.

The result is a 4-second MP4 with a white flash and a click on every second. The Encoder line says whether
the GPU's own encoder is in use. To rebuild the page, pack `demo/` with any short soundtrack and publish it to
that link.

## What comes out

- **Video:** H.264 High, from the GPU's hardware encoder when Chrome can use it for that size, otherwise
  Chrome's software encoder. The page says which.
  - Keyframe every second.
  - Default bitrate 40 Mbit/s at 1080×1920 and 30 fps.
  - MP4 with the movie header first, so uploads can start reading it right away.
- **Sound:** the packed AAC copied in unchanged. Its encoder delay is trimmed with an edit list, so it starts
  on the right sample.
- The demo test measures sound against picture at 0.0 ms apart.

A GPU can differ from the cloud renderer in floating-point detail, so a pixel may differ by a level or two. A
frame of the Spawn ad rendered both ways measures 37 dB PSNR apart, which is encoder noise. Nothing visible
changes.

## Test (in a cloud session)

```bash
node gpu-render/test/e2e.mjs
```

This packs the demo in `demo/` and renders it whole and as a 2-second test. The demo flashes white every
second over a matching click track, and draws its frame number as a barcode. The test checks:

- codec, size and frame count;
- that the file decodes cleanly;
- every frame present and in order;
- sound against picture.

```bash
node gpu-render/test/e2e.mjs --bundle gpu-render/dist/spawn-ad --seconds 1 --from 8.3
```

This test-renders part of a packed project. The headless browser here has no GPU, so it checks the pipeline,
not the speed: 0.3 frames/s for the Spawn ad here, against tens of frames per second on a real graphics card.

## Limits

- The encoded video stays in memory until it's saved: about the bitrate times the length, twice over. A
  30-second 1080×1920 render at 40 Mbit/s needs about 300 MB.
- Browsers slow down hidden tabs. Keep the tab in front, and keep a laptop plugged in.
- Chrome and Edge have the H.264 encoder this needs. Safari and Firefox are not supported.

## Files

- `pack.mjs`: bundles a project (cloud side).
- `runtime/harness.js`: the render page's engine and controls.
- `runtime/mp4.js`: the MP4 writer (H.264 + AAC, interleaved, edit lists, colour tags).
- `runtime/adts.js`: reads the AAC soundtrack.
- `runtime/shim.js`: runs before the project. It rebuilds the files pack carried as text when they're
  fetched, and answers `fetch()` of `blob:` and `data:` URLs from memory: three.js fetches the textures inside
  `.glb` models that way, and an artifact's policy may not allow the fetch. Pack writes the table of carried
  files next to it as `packed.js`.
- `demo/`: a dependency-free WebGL2 test project.
- `test/e2e.mjs`: the end-to-end test.
