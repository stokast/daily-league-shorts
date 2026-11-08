// Loaded before the project's own code; it changes what fetch() can read, nothing else.
// - Files an artifact can't serve as they are (.glb, .bin, .hdr, the .aac soundtrack) were packed as base64
//   text parts (see pack.mjs); a fetch of the original URL rebuilds the file from them.
// - Some hosts (a published artifact among them) don't let fetch() read blob: or data: URLs, and libraries such
//   as three.js fetch the blob: URLs they make for textures inside .glb files: those are answered from memory.
import { PACKED } from './packed.js';

const blobs = new Map();
const create = URL.createObjectURL.bind(URL);
const revoke = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (obj) => {
  const url = create(obj);
  if (obj instanceof Blob) blobs.set(url, obj);
  return url;
};
URL.revokeObjectURL = (url) => {
  blobs.delete(url);
  revoke(url);
};

function base64Bytes(text) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(text);
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fromDataURL(url) {
  const comma = url.indexOf(',');
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  const type = meta.split(';')[0] || 'text/plain';
  if (meta.endsWith(';base64')) return new Blob([base64Bytes(payload)], { type });
  return new Blob([decodeURIComponent(payload)], { type });
}

const nativeFetch = window.fetch.bind(window);
const root = new URL('../', import.meta.url).href; // the bundle's root (this file is in gpu-render/)
const rebuilt = new Map(); // path -> Promise<Blob>

function rebuild(path, entry) {
  if (!rebuilt.has(path)) {
    rebuilt.set(path, (async () => {
      const texts = await Promise.all(entry.parts.map(async (p) => {
        const r = await nativeFetch(root + p);
        if (!r.ok) throw new Error(`${p}: ${r.status}`);
        return r.text();
      }));
      let bytes = base64Bytes(texts.join(''));
      if (entry.gzip) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      return new Blob([bytes], { type: entry.type });
    })());
  }
  return rebuilt.get(path);
}

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
  if (url && url.startsWith('blob:') && blobs.has(url)) {
    const b = blobs.get(url);
    return new Response(b, { status: 200, headers: { 'Content-Type': b.type || 'application/octet-stream' } });
  }
  if (url && url.startsWith('data:')) {
    const b = fromDataURL(url);
    return new Response(b, { status: 200, headers: { 'Content-Type': b.type } });
  }
  if (url) {
    const abs = new URL(url, document.baseURI);
    abs.search = '';
    abs.hash = '';
    if (abs.href.startsWith(root)) {
      const path = decodeURIComponent(abs.href.slice(root.length));
      const entry = PACKED[path];
      if (entry) {
        const b = await rebuild(path, entry);
        return new Response(b, { status: 200, headers: { 'Content-Type': entry.type, 'Content-Length': String(b.size) } });
      }
    }
  }
  return nativeFetch(input, init);
};
