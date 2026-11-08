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
  enter: openKeys[openKeys.length - 1] + 0.32,
};

// ---- Act 2: sucked into the cable ---------------------------------------------------------------
// On enter the cable mouth glows open behind the words; the words are handed to the 3D scene and
// sucked into it (centre letters first), then the camera dives in after them.
const IN_OPEN = OPEN.enter;
const IN_HANDOFF = IN_OPEN + 0.16; // 2D text -> 3D letters (they start moving here)
const IN_LETTER_T = 0.42; // seconds from a letter's start to the mouth
const IN_STAGGER = 0.012; // between letters (19 of them)
const IN_SWALLOW = [IN_HANDOFF + IN_LETTER_T, IN_HANDOFF + IN_LETTER_T + 18 * IN_STAGGER];
const IN_DIVE = [IN_OPEN + 0.66, IN_OPEN + 1.2];
export const IN = {
  open: IN_OPEN,
  handoff: IN_HANDOFF,
  letterT: IN_LETTER_T,
  stagger: IN_STAGGER,
  swallow: IN_SWALLOW, // letters cross the mouth
  suck: [IN_OPEN, IN_SWALLOW[1] + 0.05], // the whole pull, for the sound
  approach: IN_DIVE, // the camera dives in after them
  tunnel: [IN_DIVE[1], IN_DIVE[1] + 1.2], // inside the cable, accelerating
  flash: IN_DIVE[1] + 1.2, // white-out at the end of the cable = the drop
};

// ---- Act 3: the game world ----------------------------------------------------------------------
export const W0 = IN.flash; // music downbeat
export const beat = (k) => W0 + k * BEAT;
export const WORLD = { start: W0, barIn: beat(1.5) };
// The horse's right-lead canter: src/horse.js poses it, audio/make_audio.py puts hoofbeats on its footfalls.
// Phase = (t - W0 + offset) / period; each hoof lands at its td phase.
export const CANTER = { period: 0.64, offset: 0.21, td: { LH: 0.0, RH: 0.19, LF: 0.21, RF: 0.38 } };

// Hero/mid prompts: each is a prompt card floating in the air that types itself; its game's screen
// lands above it on the `impact` beat. The card appears `cardIn` (a moment before the first key).
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
  return { ...p, index: i, kind: i < 3 ? 'hero' : 'mid', impact, enter, keys, cardIn: keys[0] - 0.12 };
});

// Montage: a burst of prompts typed fast all over the sky ("i want to make a ___ game"), several at
// once, each landing its game. Words match each screen's meta.word.
export const MONTAGE_PREFIX = 'i want to make a ';
export const MONTAGE_SUFFIX = ' game';
const MONTAGE_WORDS = {
  farm: 'cozy farming', pirate: 'pirate', kart: 'kart racing', ninja: 'ninja', monster: 'monster taming', dungeon: 'dungeon',
  dodgeball: 'dodgeball', hero: 'superhero', rhythm: 'rhythm', tower: 'tower defense', mech: 'mech', golf: 'mini golf',
  cooking: 'cooking', western: 'western', dino: 'dinosaur', deepsea: 'deep sea',
};
const MONTAGE_IDS = [
  'farm', 'pirate', 'kart', // quarter notes
  'ninja', 'monster', 'dungeon', 'dodgeball', 'hero', 'rhythm', 'tower', 'mech', 'golf', 'cooking', 'western', 'dino', 'deepsea', // eighths
];
export const MONTAGE = MONTAGE_IDS.map((screen, i) => {
  const k = i < 3 ? 23 + i : 26 + (i - 3) * 0.5;
  const impact = beat(k);
  const word = MONTAGE_WORDS[screen];
  const text = MONTAGE_PREFIX + word + MONTAGE_SUFFIX;
  const enter = impact - 0.08;
  const typeDur = i < 3 ? 0.55 : 0.42;
  const keys = typedTo(text, enter - 0.05, typeDur / text.length, 700 + i);
  return { screen, index: i, kind: 'montage', impact, swap: impact - 0.07, word, text, keys, enter, cardIn: keys[0] - 0.18 };
});
export const MONTAGE_START = beat(22.2); // template appears (after the zombie prompt is sent)

// Climax: "i want to make anything" then everything is pulled back into the cable.
const climaxText = 'i want to make anything';
const climaxKeys = typedFrom(climaxText, beat(32.3), 0.028, 404);
export const CLIMAX = {
  text: climaxText,
  keys: climaxKeys,
  enter: beat(34.4),
  cardIn: climaxKeys[0] - 0.3,
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
  ev.push({ t: IN.swallow[0], type: 'swallow', end: IN.swallow[1] });
  ev.push({ t: IN.approach[0], type: 'dive', end: IN.approach[1] });
  ev.push({ t: IN.tunnel[0], type: 'tunnel', end: IN.tunnel[1] });
  ev.push({ t: IN.flash, type: 'drop' });
  for (const p of PROMPTS) {
    keys(p.text, p.keys, p.mean < 0.03 ? 'fast' : 'world');
    ev.push({ t: p.enter, type: 'enter', tag: 'world' });
    ev.push({ t: p.impact, type: 'spawn', screen: p.screen, kind: p.kind });
  }
  for (const m of MONTAGE) {
    keys(m.text, m.keys, 'montage');
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
