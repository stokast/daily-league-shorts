// Dump the timeline for the audio script: node tools/timeline-json.mjs [out=build/timeline.json]
import fs from 'node:fs';
import path from 'node:path';
import * as TL from '../src/timeline.js';
const out = process.argv[2] || 'build/timeline.json';
fs.mkdirSync(path.dirname(out), { recursive: true });
const data = {
  fps: TL.FPS, duration: TL.DURATION, bpm: TL.BPM, beat: TL.BEAT, w0: TL.W0,
  open: TL.OPEN, in: TL.IN, prompts: TL.PROMPTS, montage: TL.MONTAGE, climax: TL.CLIMAX, out: TL.OUT, end: TL.END,
  events: TL.events(),
};
fs.writeFileSync(out, JSON.stringify(data, null, 1));
console.log('wrote', out, data.events.length, 'events');
