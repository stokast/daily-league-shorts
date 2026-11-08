# Spawn ad

A 30-second vertical (1080x1920, 30 fps) video ad for [Spawn](https://www.spawn.co), rendered entirely from
code: a Three.js page drawn frame by frame in headless Chromium, and a soundtrack synthesized in Python. No
footage, samples or stock music. Separate from the rest of this repo.

## The cut
| time | what happens |
|---|---|
| 0.0 | black screen, Spawn's pixel font, a blinking block cursor; `i want to make a game` is typed |
| 2.5 | enter: a cable's glowing mouth opens behind the words and sucks them in (air rushing in, letters stretched and swallowed); we dive in after them |
| 3.7 | through the cable, overtaking our own words: twisted glowing strands, data packets streaking past, light at the end |
| 4.9 | white burst into an MMO quest-hub village at golden hour: a hooded rider on a draft horse canters through the town gate and down the street (third person, three-quarter view from behind; HUD: player frame, minimap, quest tracker) |
| 5.9 | prompts typed in a chat bubble above the rider; each game's title/loading screen spawns ahead in the sky (pixel dissolve, on the beat) and you ride under it, its prompt as a caption |
| 16.3 | montage: 16 more prompts type all over the sky at once and their games pour past overhead |
| 21.0 | `i want to make anything`, enter: the world drains into a vortex |
| 22.9 | back out through the same cable, backwards; the cable end shrinks into the cursor |
| 25.4 | `create with SpawnAI`; the cursor turns into Spawn's sparkle; the logo + spawn.co |

Every game shown is made up (names, logos, characters); they evoke genres (fighting, military shooter, space
social deduction, racing, horror...) without copying any real game. The village uses CC0 assets (Poly Haven sky and
PBR textures and props, an ambientCG leaf set), listed in `tools/assets.json`. The horse is "HORSE [DRAFT HORSE]" by
BlueMesh on Sketchfab, **CC BY 4.0: credit it wherever the ad is published**:

> Horse: "HORSE [DRAFT HORSE]" by BlueMesh (sketchfab.com/3d-models/725065392aad4b04b7a172f8cd965497), CC BY 4.0; animated and fitted with tack for this ad.

It comes rigged but not animated: its canter, saddle cloth and saddle are made in `src/horse.js` and `src/rider.js`.
Spawn's own brand comes from its site: Geist Pixel Square (the `geist` npm package, OFL), `#070708`, white, peach `#ffd9a0`, teal `#1d96a0`.

## Make it
```
npm install                      # three, geist, @fontsource/* display fonts
pip install numpy scipy pyloudnorm
node tools/fetch-assets.mjs      # sky, textures, models and the horse into assets/ (git-ignored, ~265 MB)
npm run audio                    # build/timeline.json -> build/audio.wav (-14 LUFS, <= -1 dBTP)
npm run preview                  # 540x960 check, ~6 min
npm run render                   # build/spawn-ad-1080x1920.mp4
node render/stills.mjs 7.5,12,19 scratch/stills 0.5 scratch/sheet.png 3   # review stills / sheet
node tools/screens-sheet.mjs fighter,shooter 0.2,1,3 scratch/s.png         # review title screens
```
Chromium and Playwright must be installed (the render uses SwiftShader, so no GPU is needed).

To render on a graphics card instead, with nothing installed where it renders: `npm run gpu-pack` bundles the
ad (after `npm run audio`) into `../gpu-render/dist/spawn-ad`, which Claude publishes as a private link. Open it
in Chrome or Edge and press Render video. See `../gpu-render/README.md`.

## Map
- `src/timeline.js`: every time in the ad (typing is humanized, prompts land on the 120 BPM grid). The page
  and `audio/make_audio.py` both read it, so picture and sound stay in sync.
- `src/main.js`: renderer, post chain (bloom + `src/post.js`: vortex/pinch, radial blur, aberration, flash,
  grain, dither, overlay composite) and `window.ad` used by the render scripts.
- `src/overlay.js`: everything typed (opening, chat bar, montage reel, streaks, end card).
- `src/tunnel.js`: the cable. `src/world.js`, `src/village.js`, `src/assets.js`: the village. `src/ride.js`: the road
  and the follow camera. `src/horse.js`: the horse (its loose hair bound to its rig, cloth draped on its back, a
  right-lead canter solved by IK each frame so the hooves stay planted). `src/rider.js`: the tack and the rider.
  `src/panels.js`, `src/promptcard.js`: the chat bubble, the floating title screens and their prompts.
- `src/screens/*.js`: one module per made-up game (`BRIEF.md` has the rules), drawn with Canvas2D.
- `render/`: static server, stills, and the video renderer (parallel jobs, then one x264 encode + audio).
