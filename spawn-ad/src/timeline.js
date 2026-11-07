// The ad's timing, in seconds. One source of truth: the page draws from it and the audio script
// reads the same numbers (tools/timeline-json.mjs dumps them to build/timeline.json).
import { rng } from './util.js';

export const FPS = 30;
export const DURATION = 30.0;
export const BPM = 120;
export const BEAT = 60 / BPM;

// Humanized key times: gaps around `mean`, a little longer after a finished word.
function keyGaps(text, mean, seed, jitter = 0.38) {
  const r = rng(seed);
  const rel = [0];
  for (let i = 1; i < text.length; i++) {
    let g = mean * (1 + (r() * 2 - 1) * jitter);
    if (text[i - 1] === ' ') g *= 1.4;
    if (text[i] === ' ') g *= 0.85;
    rel.push(rel[i - 1] + g);
  }
  return rel;
}
const typedFrom = (text, start, mean, seed) => keyGaps(text, mean, seed).map((x) => x + start);
const typedTo = (text, last, mean, seed) => {
  const rel = keyGaps(text, mean, seed);
  return rel.map((x) => x + last - rel[rel.length - 1]);
};

// ---- Act 1: black screen, cursor, "i want to make a game" -------------------------------------
const openText = 'i want to make a game';
const openKeys = typedFrom(openText, 0.78, 0.066, 11);
export const OPEN = {
  text: openText,
  keys: openKeys,
  blink: [[0, 0.42]], // cursor on-intervals before typing starts (it stays on while typing)
  enter: 2.62,
};

// ---- Act 2: sucked into the cable ---------------------------------------------------------------
export const IN = {
  suck: [OPEN.enter, OPEN.enter + 0.36], // letters swirl into the centre point
  approach: [OPEN.enter + 0.3, 3.42], // the cable end grows out of the point; we dive in
  tunnel: [3.42, 4.62], // inside the cable, accelerating
  flash: 4.62, // white-out at the end of the cable = the drop
};

// ---- Act 3: the game world ----------------------------------------------------------------------
export const W0 = IN.flash; // music downbeat
export const beat = (k) => W0 + k * BEAT;
export const WORLD = { start: W0, barIn: beat(1.5) };

// Hero/mid prompts: typed in full into the chat bar; the screen lands on the `impact` beat.
const PROMPTS_DEF = [
  { screen: 'fighter', text: 'i want to make a fighting game', k: 5, mean: 0.042 },
  { screen: 'shooter', text: 'i want to make a military shooter', k: 9, mean: 0.040 },
  { screen: 'traitor', text: 'i want to make a space traitor game', k: 13, mean: 0.038 },
  { screen: 'dogboss', text: 'i want to recreate my dog as a final boss', k: 17, mean: 0.034 },
  { screen: 'racing', text: 'i want to make a racing game', k: 19, mean: 0.022 },
  { screen: 'zombie', text: 'i want to recreate my school with zombies', k: 21, mean: 0.016 },
];
export const PROMPTS = PROMPTS_DEF.map((p, i) => {
  const impact = beat(p.k);
  const enter = impact - (p.mean > 0.03 ? 0.12 : 0.10);
  const keys = typedTo(p.text, enter - (p.mean > 0.03 ? 0.2 : 0.1), p.mean, 101 + i);
  return { ...p, index: i, kind: i < 3 ? 'hero' : 'mid', impact, enter, keys };
});

// Montage: the bar reads "i want to make a ___ game"; the blank flips to a new word and that game spawns.
export const MONTAGE_PREFIX = 'i want to make a ';
export const MONTAGE_SUFFIX = ' game';
const MONTAGE_IDS = [
  'farm', 'pirate', 'kart', // quarter notes
  'ninja', 'monster', 'dungeon', 'dodgeball', 'hero', 'rhythm', 'tower', 'mech', 'golf', 'cooking', 'western', 'dino', 'deepsea', // eighths
];
export const MONTAGE = MONTAGE_IDS.map((screen, i) => {
  const k = i < 3 ? 23 + i : 26 + (i - 3) * 0.5;
  const impact = beat(k);
  return { screen, index: i, kind: 'montage', impact, swap: impact - 0.07 };
});
export const MONTAGE_START = beat(22.2); // template appears (after the zombie prompt is sent)

// Climax: "i want to make anything" then everything is pulled back into the cable.
const climaxText = 'i want to make anything';
export const CLIMAX = {
  text: climaxText,
  keys: typedFrom(climaxText, beat(32.3), 0.028, 404),
  enter: beat(34.4),
};
export const OUT = {
  vortex: [CLIMAX.enter + 0.02, beat(36)], // screens and world swirl into the centre
  flash: beat(36),
  tunnel: [beat(36), beat(36) + 1.3], // backwards through the cable
  recede: [beat(36) + 1.3, beat(36) + 1.75], // the cable end shrinks to a point
};

// ---- Act 4: black screen, "create with SpawnAI" -------------------------------------------------
const endText = 'create with SpawnAI';
const endStart = OUT.recede[1] + 0.8;
const endKeys = typedFrom(endText, endStart, 0.07, 909);
export const END = {
  cursorAt: OUT.recede[1],
  blink: [[OUT.recede[1], OUT.recede[1] + 0.4]],
  text: endText,
  keys: endKeys,
  sparkle: endKeys[endKeys.length - 1] + 0.32, // the cursor turns into Spawn's sparkle
  url: endKeys[endKeys.length - 1] + 0.85, // "spawn.co" fades in
};

export const SPAWNS = [...PROMPTS, ...MONTAGE].sort((a, b) => a.impact - b.impact);

/** Flat event list for the sound design. */
export function events() {
  const ev = [];
  const keys = (text, times, tag) => times.forEach((t, i) => ev.push({ t, type: 'key', ch: text[i], tag }));
  keys(OPEN.text, OPEN.keys, 'open');
  ev.push({ t: OPEN.enter, type: 'enter', tag: 'open' });
  ev.push({ t: IN.suck[0], type: 'suck', end: IN.suck[1] });
  ev.push({ t: IN.approach[0], type: 'dive', end: IN.approach[1] });
  ev.push({ t: IN.tunnel[0], type: 'tunnel', end: IN.tunnel[1] });
  ev.push({ t: IN.flash, type: 'drop' });
  for (const p of PROMPTS) {
    keys(p.text, p.keys, p.mean < 0.03 ? 'fast' : 'world');
    ev.push({ t: p.enter, type: 'enter', tag: 'world' });
    ev.push({ t: p.impact, type: 'spawn', screen: p.screen, kind: p.kind });
  }
  for (const m of MONTAGE) {
    ev.push({ t: m.swap, type: 'swap', screen: m.screen });
    ev.push({ t: m.impact, type: 'spawn', screen: m.screen, kind: 'montage', index: m.index });
  }
  keys(CLIMAX.text, CLIMAX.keys, 'fast');
  ev.push({ t: CLIMAX.enter, type: 'enter', tag: 'climax' });
  ev.push({ t: OUT.vortex[0], type: 'vortex', end: OUT.vortex[1] });
  ev.push({ t: OUT.flash, type: 'flash_out' });
  ev.push({ t: OUT.tunnel[0], type: 'tunnel_out', end: OUT.tunnel[1] });
  ev.push({ t: OUT.recede[0], type: 'recede', end: OUT.recede[1] });
  keys(END.text, END.keys, 'end');
  ev.push({ t: END.sparkle, type: 'sparkle' });
  ev.push({ t: END.url, type: 'url' });
  return ev.sort((a, b) => a.t - b.t);
}
