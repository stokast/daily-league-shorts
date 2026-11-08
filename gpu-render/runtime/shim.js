// Loaded before the project's own code. Some hosts (a published artifact among them) don't let fetch() read
// blob: or data: URLs; libraries such as three.js fetch the blob: URLs they make for textures packed inside
// .glb files. This answers those fetches from memory instead of the network.
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

function fromDataURL(url) {
  const comma = url.indexOf(',');
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  const type = meta.split(';')[0] || 'text/plain';
  if (meta.endsWith(';base64')) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
  return new Blob([decodeURIComponent(payload)], { type });
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
  if (url && url.startsWith('blob:') && blobs.has(url)) {
    const b = blobs.get(url);
    return Promise.resolve(new Response(b, { status: 200, headers: { 'Content-Type': b.type || 'application/octet-stream' } }));
  }
  if (url && url.startsWith('data:')) {
    const b = fromDataURL(url);
    return Promise.resolve(new Response(b, { status: 200, headers: { 'Content-Type': b.type } }));
  }
  return nativeFetch(input, init);
};
