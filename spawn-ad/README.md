# Spawn ad

A 30-second vertical (1080x1920, 30 fps) video ad for [Spawn](https://www.spawn.co), rendered entirely from
code: a Three.js page drawn frame by frame in headless Chromium, and a soundtrack synthesized in Python. No
footage, samples or stock music. Separate from the rest of this repo.

## The cut
| time | what happens |
|---|---|
| 0.0 | black screen, Spawn's pixel font, a blinking block cursor; `i want to make a game` is typed |
| 2.6 | enter: the line swirls into a point of light, which is the end of a cable; we dive in |
| 3.4 | through the cable: twisted glowing strands, data packets streaking past, light at the end |
| 4.6 | white burst into a dusk game world: you spawn on a pad, a shockwave reveals the level grid |
| 5.6 | prompts typed into a Spawn-style chat bar; each spawns its game's title/loading screen (pixel dissolve), on the beat |
| 16.1 | montage: `i want to make a ___ game` flips through 16 genres, the sky fills with games |
| 20.8 | `i want to make anything`, enter: the world drains into a vortex |
| 22.6 | back out through the same cable, backwards; the cable end shrinks into the cursor |
| 25.2 | `create with SpawnAI`; the cursor turns into Spawn's sparkle; the logo + spawn.co |

Every game shown is made up (names, logos, characters); they evoke genres (fighting, military shooter, space
social deduction, racing, horror...) without copying any real game. Spawn's own brand comes from its site:
Geist Pixel Square (the `geist` npm package, OFL), `#070708`, white, peach `#ffd9a0`, teal `#1d96a0`.

## Make it
```
npm install                      # three, geist, @fontsource/* display fonts
pip install numpy scipy pyloudnorm
npm run audio                    # build/timeline.json -> build/audio.wav (-14 LUFS, <= -1 dBTP)
npm run preview                  # 540x960 check, ~6 min
npm run render                   # build/spawn-ad-1080x1920.mp4
node render/stills.mjs 7.5,12,19 scratch/stills 0.5 scratch/sheet.png 3   # review stills / sheet
node tools/screens-sheet.mjs fighter,shooter 0.2,1,3 scratch/s.png         # review title screens
```
Chromium and Playwright must be installed (the render uses SwiftShader, so no GPU is needed).

## Map
- `src/timeline.js`: every time in the ad (typing is humanized, prompts land on the 120 BPM grid). The page
  and `audio/make_audio.py` both read it, so picture and sound stay in sync.
- `src/main.js`: renderer, post chain (bloom + `src/post.js`: vortex/pinch, radial blur, aberration, flash,
  grain, dither, overlay composite) and `window.ad` used by the render scripts.
- `src/overlay.js`: everything typed (opening, chat bar, montage reel, streaks, end card).
- `src/tunnel.js`, `src/world.js`, `src/panels.js`: the cable, the game world, the floating title screens.
- `src/screens/*.js`: one module per made-up game (`BRIEF.md` has the rules), drawn with Canvas2D.
- `render/`: static server, stills, and the video renderer (parallel jobs, then one x264 encode + audio).
