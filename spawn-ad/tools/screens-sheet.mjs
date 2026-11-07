// Render a review sheet of title screens to PNG.
// usage: node tools/screens-sheet.mjs <ids comma list> <times comma list> <out.png> [cellWidth=640] [canvasWidth=1280]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { serve } from '../render/server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , ids, times = '0.3,0.8,2', out = 'sheet.png', cell = '640', w = '1280'] = process.argv;
const root = new URL('..', import.meta.url).pathname;
const server = await serve(root);
const browser = await chromium.launch({ args: ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('console', (m) => console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const url = `http://127.0.0.1:${server.address().port}/tools/screens.html?ids=${ids}&times=${times}&cell=${cell}&w=${w}`;
await page.goto(url);
try {
  await page.waitForFunction('window.done===true', null, { timeout: 120000 });
  const { stats, sheet } = await page.evaluate(() => ({ stats: window.stats, sheet: window.sheet }));
  fs.writeFileSync(out, Buffer.from(sheet.split(',')[1], 'base64'));
  console.log(stats.join('\n'));
  console.log('wrote', out);
} catch (e) {
  console.log('failed:', e.message);
  process.exitCode = 1;
}
await browser.close();
server.close();
