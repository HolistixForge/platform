import { chromium } from 'playwright';
const ids = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const id of ids) {
  await p.goto(`http://localhost:6007/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(1500);
  const root = await p.$('#storybook-root');
  const box = root ? await root.boundingBox() : null;
  console.log(id, '→ #storybook-root', box ? `${Math.round(box.width)}x${Math.round(box.height)} @ ${Math.round(box.x)},${Math.round(box.y)}` : 'ABSENT');
  await p.screenshot({ path: `/tmp/shot-${id}.png` });
}
await b.close();
