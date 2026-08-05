import { chromium } from 'playwright';

const res = await fetch('http://localhost:6007/index.json');
const ids = Object.values((await res.json()).entries).filter(e => e.type === 'story').map(e => e.id);

const b = await chromium.launch();
const out = [];
for (const id of ids) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let verdict = 'OK', ms = 0, note = '';
  const t0 = Date.now();
  try {
    await p.goto(`http://localhost:6007/iframe.html?id=${id}&viewMode=story`,
                 { waitUntil: 'domcontentloaded', timeout: 20000 });
    // the root having children is the proof the story mounted
    await p.waitForFunction(
      () => { const r = document.querySelector('#storybook-root'); return r && r.children.length > 0; },
      null, { timeout: 15000, polling: 250 });
    ms = Date.now() - t0;
    const box = await (await p.$('#storybook-root')).boundingBox();
    if (!box || box.width < 5 || box.height < 5) { verdict = 'VIDE'; note = box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'pas de box'; }
    else note = `${Math.round(box.width)}x${Math.round(box.height)}`;
  } catch (e) {
    ms = Date.now() - t0;
    verdict = ms > 14000 ? 'FREEZE' : 'ERREUR';
    note = String(e.message).split('\n')[0].slice(0, 60);
  }
  out.push({ id, verdict, ms, note });
  console.log(`${verdict.padEnd(7)} ${String(ms).padStart(6)}ms  ${id}  ${note}`);
  await p.close();
}
await b.close();
const bad = out.filter(o => o.verdict !== 'OK');
console.log(`\n=== ${out.length} stories, ${bad.length} en échec ===`);
for (const o of bad) console.log(`  ${o.verdict}  ${o.id}  ${o.note}`);
