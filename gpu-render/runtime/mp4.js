// A small MP4 writer: one H.264 video track (samples from WebCodecs' VideoEncoder) and an optional AAC audio
// track (frames from an ADTS file). The movie header comes first ("faststart"), and the media is interleaved in
// one-second chunks, the way upload sites like it. No dependencies.

const enc = new TextEncoder();

function cat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u8 = (n) => new Uint8Array([n & 255]);
const u16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255]);
const u24 = (n) => new Uint8Array([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u64 = (n) => cat([u32(Math.floor(n / 2 ** 32)), u32(n >>> 0)]);
const str = (s) => enc.encode(s);
const zeros = (n) => new Uint8Array(n);
const flat = (parts) => cat(parts.flat(Infinity).map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p))));

function box(type, ...parts) {
  const body = flat(parts);
  return cat([u32(body.length + 8), str(type), body]);
}
const full = (type, version, flags, ...parts) => box(type, u8(version), u24(flags), ...parts);
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32);

// ISO/IEC 23091-2 code points for WebCodecs colour space names
const PRIMARIES = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };
const TRANSFER = { bt709: 1, smpte170m: 6, linear: 8, 'iec61966-2-1': 13, pq: 16, hlg: 18 };
const MATRICES = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };

/** An MPEG-4 descriptor: tag, size (with continuation bytes when large), payload. */
function desc(tag, payload) {
  const n = payload.length;
  const size = n < 0x80 ? [n] : n < 0x4000 ? [0x80 | (n >> 7), n & 0x7f] : [0x80 | (n >> 21), 0x80 | ((n >> 14) & 0x7f), 0x80 | ((n >> 7) & 0x7f), n & 0x7f];
  return cat([u8(tag), new Uint8Array(size), payload]);
}

/** Run-length table rows for a list of values: [[count, value], ...]. */
function runs(values) {
  const out = [];
  for (const v of values) {
    if (out.length && out[out.length - 1][1] === v) out[out.length - 1][0]++;
    else out.push([1, v]);
  }
  return out;
}

/**
 * Build an MP4 file.
 * @param {object} o
 * @param {object} o.video
 *   width, height, timescale (ticks per second), avcC (Uint8Array: the encoder's decoderConfig.description),
 *   colorSpace (optional: WebCodecs VideoColorSpaceInit), samples: [{data, pts, dur, key}] in decode order,
 *   pts and dur in timescale ticks.
 * @param {object} [o.audio]
 *   sampleRate, channels, asc (AudioSpecificConfig bytes), frames (Uint8Array[], 1024 samples each),
 *   skip (samples to trim at the start: encoder priming plus any offset), bitrate (bits/s, for the descriptor).
 * @returns {Uint8Array}
 */
export function muxMP4({ video, audio = null }) {
  const MOVIE_TS = 1000;
  const V = video;
  const vSamples = V.samples;
  if (!vSamples.length) throw new Error('mp4: no video samples');
  // decode times: frames in decode order at the nominal frame duration
  const frameTicks = vSamples[0].dur;
  const dts = vSamples.map((_, i) => i * frameTicks);
  let comp = vSamples.map((s, i) => s.pts - dts[i]);
  const minComp = Math.min(...comp);
  const vShift = minComp < 0 ? -minComp : 0; // composition offsets must be >= 0: shift, then trim with an edit list
  comp = comp.map((c) => c + vShift);
  const vMediaDur = vSamples.length * frameTicks;
  const vDurMovie = Math.round((vMediaDur / V.timescale) * MOVIE_TS);

  const A = audio;
  const aFrames = A ? A.frames : [];
  const aMediaDur = aFrames.length * 1024;
  const aPresent = A ? Math.max(0, Math.min(aMediaDur - A.skip, Math.round((vMediaDur / V.timescale) * A.sampleRate))) : 0;
  const aDurMovie = A ? Math.round((aPresent / A.sampleRate) * MOVIE_TS) : 0;

  // ---- interleave: one chunk of each track per second of decode time
  const chunks = []; // {track: 'v'|'a', first, count, size}
  let vi = 0, ai = 0;
  for (let sec = 0; vi < vSamples.length || ai < aFrames.length; sec++) {
    const vEnd = (sec + 1) * V.timescale;
    let first = vi, size = 0;
    while (vi < vSamples.length && dts[vi] < vEnd) size += vSamples[vi++].data.length;
    if (vi > first) chunks.push({ track: 'v', first, count: vi - first, size });
    if (A) {
      const aEnd = (sec + 1) * A.sampleRate;
      first = ai; size = 0;
      while (ai < aFrames.length && ai * 1024 < aEnd) size += aFrames[ai++].length;
      if (ai > first) chunks.push({ track: 'a', first, count: ai - first, size });
    }
  }
  let mdatSize = 8;
  for (const c of chunks) { c.offset = mdatSize; mdatSize += c.size; }
  const big = mdatSize > 0xffffffff - 1e7;

  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));

  const stco = (track, base) => {
    const cs = chunks.filter((c) => c.track === track);
    return big
      ? full('co64', 0, 0, u32(cs.length), cs.map((c) => u64(base + c.offset)))
      : full('stco', 0, 0, u32(cs.length), cs.map((c) => u32(base + c.offset)));
  };
  const stsc = (track) => {
    const cs = chunks.filter((c) => c.track === track);
    const rows = [];
    cs.forEach((c, k) => { if (!rows.length || rows[rows.length - 1][1] !== c.count) rows.push([k + 1, c.count]); });
    return full('stsc', 0, 0, u32(rows.length), rows.map(([firstChunk, n]) => [u32(firstChunk), u32(n), u32(1)]));
  };
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  const tkhd = (id, dur, w, h, volume) => full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(dur), zeros(8), u16(0), u16(0), u16(volume), u16(0), MATRIX, u32(w * 65536), u32(h * 65536));
  const mdhd = (ts, dur) => full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0)); // 'und'
  const hdlr = (type, name) => full('hdlr', 0, 0, u32(0), str(type), zeros(12), str(name), u8(0));
  const elst = (segDur, mediaTime) => box('edts', full('elst', 0, 0, u32(1), u32(segDur), u32(mediaTime), u16(1), u16(0)));

  const videoTrak = (base) => {
    const cs = V.colorSpace;
    const colr = cs && cs.primaries && cs.transfer && cs.matrix
      ? box('colr', str('nclx'), u16(PRIMARIES[cs.primaries] ?? 2), u16(TRANSFER[cs.transfer] ?? 2), u16(MATRICES[cs.matrix] ?? 2), u8(cs.fullRange ? 0x80 : 0))
      : new Uint8Array(0);
    const avc1 = box('avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(V.width), u16(V.height),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff),
      box('avcC', V.avcC), colr, box('pasp', u32(1), u32(1)));
    const keys = vSamples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
    const stts = runs(vSamples.map((s) => s.dur));
    const ctts = comp.some((c) => c !== 0) ? runs(comp) : null;
    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, u32(stts.length), stts.map(([n, d]) => [u32(n), u32(d)])),
      ctts ? full('ctts', 0, 0, u32(ctts.length), ctts.map(([n, d]) => [u32(n), u32(d)])) : [],
      keys.length < vSamples.length ? full('stss', 0, 0, u32(keys.length), keys.map(u32)) : [],
      stsc('v'),
      full('stsz', 0, 0, u32(0), u32(vSamples.length), vSamples.map((s) => u32(s.data.length))),
      stco('v', base));
    return box('trak',
      tkhd(1, vDurMovie, V.width, V.height, 0),
      vShift ? elst(vDurMovie, vShift) : [],
      box('mdia', mdhd(V.timescale, vMediaDur), hdlr('vide', 'VideoHandler'),
        box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf, stbl)));
  };

  const audioTrak = (base) => {
    const bitrate = A.bitrate || 256000;
    const esds = full('esds', 0, 0, desc(0x03, cat([u16(2), u8(0),
      desc(0x04, cat([u8(0x40), u8(0x15), u24(0), u32(bitrate), u32(bitrate), desc(0x05, A.asc)])),
      desc(0x06, u8(0x02))])));
    const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(A.channels), u16(16), u16(0), u16(0), u32(A.sampleRate * 65536), esds);
    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), mp4a),
      full('stts', 0, 0, u32(1), u32(aFrames.length), u32(1024)),
      stsc('a'),
      full('stsz', 0, 0, u32(0), u32(aFrames.length), aFrames.map((f) => u32(f.length))),
      stco('a', base));
    return box('trak',
      tkhd(2, aDurMovie, 0, 0, 0x0100),
      elst(aDurMovie, A.skip),
      box('mdia', mdhd(A.sampleRate, aMediaDur), hdlr('soun', 'SoundHandler'),
        box('minf', full('smhd', 0, 0, u16(0), u16(0)), dinf, stbl)));
  };

  const moovFor = (base) => box('moov',
    full('mvhd', 0, 0, u32(0), u32(0), u32(MOVIE_TS), u32(Math.max(vDurMovie, aDurMovie)), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(A ? 3 : 2)),
    videoTrak(base),
    A ? audioTrak(base) : []);
  // the chunk offsets depend on the moov's own size, which doesn't depend on their values
  const moovSize = moovFor(0).length;
  const moov = moovFor(ftyp.length + moovSize);

  const mdatHeader = big ? cat([u32(1), str('mdat'), u64(mdatSize + 8)]) : cat([u32(mdatSize), str('mdat')]);
  const out = new Uint8Array(ftyp.length + moov.length + mdatHeader.length + (mdatSize - 8));
  let o = 0;
  out.set(ftyp, o); o += ftyp.length;
  out.set(moov, o); o += moov.length;
  out.set(mdatHeader, o); o += mdatHeader.length;
  if (big) throw new Error('mp4: over 4 GB is not supported');
  for (const c of chunks) {
    const src = c.track === 'v' ? vSamples.map((s) => s.data) : aFrames;
    for (let k = c.first; k < c.first + c.count; k++) { out.set(src[k], o); o += src[k].length; }
  }
  return out;
}
