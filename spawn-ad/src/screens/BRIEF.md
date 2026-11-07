# Title screens: brief

The ad is a 30 s vertical (1080x1920) video for Spawn (spawn.co), an AI game builder: you describe a game,
it builds it. In the middle of the ad the viewer types prompts like `i want to make a fighting game` into a
chat bar, and that game's **title screen or loading screen** spawns as a floating screen in a 3D dusk-sky
game world (violet/indigo sky, warm peach horizon, teal ground). Each screen here is one of those games.

## Every game is made up
Spawn will run this ad, so no real game may appear in it:
- invent the name (the assignment gives one; if it turns out to be a famous game's name, pick another);
- never copy a real game's logo, lettering style, colours-plus-layout combination, characters, mascots or
  signature objects. Evoke the *genre*, not a specific game. Examples of what to avoid: Street Fighter's brush
  logo, Call of Duty's logo/soldier key art, Among Us bean-shaped crewmates with visors and backpacks,
  Mario `?` blocks/pipes, Pokéballs, Tetris pieces, Minecraft blocks/creepers, Fortnite's bus, OutRun's
  Ferrari, Zelda's triforce, Mario Kart item boxes, Rocket League car-soccer;
- no real company names, ratings boards (ESRB/PEGI), console logos, or "©" lines with a real company.

## Interface
One file per screen: `src/screens/<id>.js`. Look at `src/screens/_example.js`.

```js
import * as K from './kit.js';
export const meta = { id: 'fighter', title: 'BLAZING FISTS', aspect: 16 / 9 };
export function create(w, h) {          // w x h canvas pixels: 1280x720 for heroes; montage uses 768x432
  const s = w / 1280;                   // design at 1280 wide; multiply every size by s
  // pre-render expensive things here (logo with glows/outlines, sprites) into K.makeCanvas(...)
  return {
    bg(ctx) { /* static layer, drawn ONCE: sky, scenery, characters, texture */ },
    fg(ctx, t) { /* drawn on top of bg on every update. t = seconds since the screen spawned (0..20) */ },
  };
}
```

- `fg` must not clear the canvas; it is drawn over a fresh copy of `bg` every update.
- Deterministic: same `t` -> same pixels. Never `Math.random()` / `Date`; use `K.rng(seed)` / `K.hash(i)`.
- Fast: `bg` may be heavy (drawn once). `fg` should stay under ~6 ms at 1280x720 in the harness's
  "fg(steady)" number: draw pre-rendered canvases with transforms, a little text, a few particles. Avoid
  `shadowBlur` and `filter` inside `fg` (pre-render glows into a canvas in `create`).
- `kit.js` has helpers (easing, seeded rng, gradients, `logoText` with outlines/extrusion/glow, starfield,
  ridges, skylines, rays, pixel sprites, grain, vignette, scanlines, `blinkOn`, `introPhases`). Don't edit
  `kit.js`; put extra helpers inside your own files.
- Fonts (already loaded by the page; see `src/fonts.js`): Anton, Audiowide, Bangers, Bebas Neue,
  Black Ops One, Bungee, Chakra Petch 600/700, Cinzel Decorative 700/900, Creepster, Fredoka 600/700,
  Inter 400/700/900, Lilita One, Luckiest Guy, Monoton, Nosifer, Orbitron 600/900, Permanent Marker,
  Pirata One, Press Start 2P, Righteous, Russo One, Rye, Sedgwick Ave Display, Silkscreen 400/700,
  Staatliches, Teko 400/600, Titan One, Zen Dots. Use `K.font(weight, px, family)`.

## Animation
- t = 0 .. 0.35 s: the engine reveals the panel with a pixel dissolve, so your content should already be
  there (background) and the logo should land around 0.3 to 0.6 s (a slam, a slide, a flash), with UI
  (PRESS START, menu, loading bar) settling by ~1 s. `K.introPhases(t)` gives a sensible default.
- After that, keep it alive until t = 20 s with idle motion: blinking PRESS START, flicker, drifting
  particles/embers/stars, a loading bar filling, characters bobbing. Subtle is fine; frozen is not.

## How it will be seen
- Floating in the sky with bloom (threshold ~0.8 luminance): small bright highlights glow nicely, but avoid
  big near-white areas (more than ~25% of the screen) or they will blow out.
- Hero screens are seen at ~650-950 px wide for about 2 s, then drift aside and shrink to ~300-450 px.
- Montage screens are seen at ~220-480 px wide for well under a second. They must read instantly when
  small: one big logo (cap height at least ~18% of the screen height), high contrast, one strong silhouette
  composition, no fine print that matters.
- Every screen should look like a polished, real game's title/loading screen at a glance: a clear focal
  point, depth (foreground/midground/background), lighting (rim light, glow, atmospheric gradient), a logo
  with real treatment (outline, bevel/extrusion, gradient), and genre-appropriate UI.

## Review loop
From `/home/user/roblox-shorts-test/spawn-ad`:

```
node tools/screens-sheet.mjs <id[,id2...]> <times> <out.png> [cellWidth=640] [canvasWidth=1280]
# e.g. node tools/screens-sheet.mjs fighter 0.15,0.4,0.8,3 scratch/sheets/fighter.png 640
#      node tools/screens-sheet.mjs fighter 3 scratch/sheets/fighter_small.png 360   (small-size check)
```

It prints timings (create / bg / fg) and writes a PNG sheet you can look at with the Read tool. Check every
screen at full size and at small size before calling it done.
