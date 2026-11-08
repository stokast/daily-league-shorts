// ADTS (AAC frames each with a small header, as `ffmpeg -c:a aac -f adts` writes them) -> raw AAC frames plus the
// AudioSpecificConfig an MP4 needs. No dependencies.

const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/**
 * @param {Uint8Array} bytes an .aac (ADTS) file
 * @returns {{objectType: number, sampleRate: number, channels: number, asc: Uint8Array, frames: Uint8Array[]}}
 */
export function parseADTS(bytes) {
  const frames = [];
  let cfg = null;
  let i = 0;
  while (i + 7 <= bytes.length) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xf0) !== 0xf0) throw new Error(`ADTS: lost sync at byte ${i}`);
    const protectionAbsent = bytes[i + 1] & 1;
    const profile = (bytes[i + 2] >> 6) & 3; // object type - 1 (1 = AAC-LC)
    const sfi = (bytes[i + 2] >> 2) & 0xf;
    const channels = ((bytes[i + 2] & 1) << 2) | (bytes[i + 3] >> 6);
    const len = ((bytes[i + 3] & 3) << 11) | (bytes[i + 4] << 3) | (bytes[i + 5] >> 5);
    const blocks = (bytes[i + 6] & 3) + 1;
    if (blocks !== 1) throw new Error('ADTS: frames with several raw blocks are not supported');
    if (len < 7 || i + len > bytes.length) throw new Error(`ADTS: bad frame length at byte ${i}`);
    const head = protectionAbsent ? 7 : 9;
    if (!cfg) cfg = { objectType: profile + 1, sfi, sampleRate: RATES[sfi], channels };
    frames.push(bytes.subarray(i + head, i + len));
    i += len;
  }
  if (!cfg) throw new Error('ADTS: no frames');
  // AudioSpecificConfig: object type (5 bits), frequency index (4), channel configuration (4), 3 zero bits
  const asc = new Uint8Array([(cfg.objectType << 3) | (cfg.sfi >> 1), ((cfg.sfi & 1) << 7) | (cfg.channels << 3)]);
  return { objectType: cfg.objectType, sampleRate: cfg.sampleRate, channels: cfg.channels, asc, frames };
}
