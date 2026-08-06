import { chromium } from 'playwright';
const b = await chromium.launch();
for (const id of ['modules-jupyter-components-terminal--default','modules-jupyter-components-forms-newkernel--normal','modules-jupyter-views-main--default']) {
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e.message).split('\n')[0].slice(0,75)));
  await p.goto(`http://localhost:6006/iframe.html?id=${id}&viewMode=story`, {waitUntil:'domcontentloaded', timeout:40000});
  await new Promise(r=>setTimeout(r,6000));
  const txt=(await p.evaluate(()=>document.body.innerText||'')).trim().slice(0,45).replace(/\s+/g,' ');
  console.log(`${id}\n   "${txt}"  ${errs.length?'ERR: '+[...new Set(errs)][0]:'sans erreur'}`);
  await p.close();
}
await b.close(); process.exit(0);
