// Tiny static file server for the ad's page, plus a POST /frame endpoint for raw frames.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

export function serve(root, { onFrame } = {}) {
  const server = http.createServer((req, res) => {
    const [pathname, query = ''] = req.url.split('?');
    if (req.method === 'POST' && pathname === '/frame') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          const i = +(new URLSearchParams(query).get('i'));
          await onFrame?.(i, Buffer.concat(chunks));
          res.writeHead(200); res.end('ok');
        } catch (e) { res.writeHead(500); res.end(String(e)); }
      });
      return;
    }
    const url = decodeURIComponent(pathname);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

export const BROWSER_ARGS = [
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];
