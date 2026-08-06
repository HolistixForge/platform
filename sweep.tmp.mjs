import { chromium } from 'playwright';
const j = await (await fetch('http://localhost:6006/index.json')).json();
const ids = Object.values(j.entries).filter(e => e.type === 'story');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
let bad = 0;
for (const s of ids) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('JS: ' + String(e.message).split('\n')[0].slice(0,85)));
  p.on('console', m => { if (m.type()==='error') { const t=m.text();
    if (!/Warning:|DevTools|favicon|contentEditable|unique "key"/.test(t)) errs.push(t.slice(0,85)); }});
  try {
    await p.goto(`http://localhost:6006/iframe.html?id=${s.id}&viewMode=story`, {waitUntil:'domcontentloaded', timeout:25000});
    await p.waitForFunction(() => {
      const vis = el => { if(!el) return false; const r=el.getBoundingClientRect(); return r.width>2&&r.height>2; };
      const root = document.querySelector('#storybook-root');
      return vis(root) || (document.body.innerText||'').trim().length>0;
    }, null, {timeout:15000, polling:250});
    await new Promise(r => setTimeout(r, 1500));
  } catch { errs.unshift('RIEN DE PEINT'); }
  if (errs.length) { bad++; console.log(`${s.id}\n   ${[...new Set(errs)][0]}`); }
  await p.close();
}
await b.close();
console.log(`\n=== ${ids.length} stories · ${bad} en échec ===`);
