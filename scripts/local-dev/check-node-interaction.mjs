/**
 * Who gets the click on a node drawn inside the Excalidraw scene.
 *
 * There are two answers and they have to swap on one keystroke:
 *
 *   default mode   the node — it is live, and a notebook you have to click
 *                  twice to reach is a notebook with a door in front of it
 *   move mode      the canvas — so Excalidraw can select the element and drag
 *                  it, which is how a node is moved now
 *
 * Neither is visible in a screenshot and neither throws when it breaks: the
 * failure is a click that goes to the wrong place, which reads as "the board
 * feels wrong". Hence a script.
 *
 *   node scripts/local-dev/check-node-interaction.mjs
 *
 * Its own disposable browser, because the one being driven by hand is a
 * shared resource and a board that locks its renderer takes the whole browser
 * with it.
 */
import { chromium } from 'playwright';

const BASE = process.env.HOLISTIX_BASE ?? 'https://apollo.test:8443';
const ORG = process.env.HOLISTIX_ORG ?? '5b927daf-4ca8-45a7-adbe-32bce35988f7';
const PROJECT = process.env.HOLISTIX_PROJECT ?? 'sync-test';
const EMAIL = process.env.HOLISTIX_EMAIL ?? 'claude@test.local';
const PASSWORD = process.env.HOLISTIX_PASSWORD ?? 'TestUser123!';

/**
 * Whether the page still answers.
 *
 * A frozen renderer does not reject — it never replies. So every question is
 * asked with a deadline, and a timeout is itself the answer.
 */
const ask = async (page, fn, ms = 15000) => {
  try {
    return await Promise.race([
      page.evaluate(fn),
      new Promise((_, rej) => setTimeout(() => rej(new Error('FROZEN')), ms)),
    ]);
  } catch (e) {
    return { frozen: String(e.message).includes('FROZEN'), error: e.message };
  }
};

const main = async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const report = { pageErrors: [] };
  page.on('pageerror', (e) => {
    if (report.pageErrors.length < 4)
      report.pageErrors.push(String(e.message).slice(0, 200));
  });

  /** Every event the board dispatches, by type. */
  let dispatched = {};
  page.on('request', (r) => {
    if (!r.url().includes('/collab/event')) return;
    try {
      const t = JSON.parse(r.postData() ?? '{}')?.event?.type;
      if (t) dispatched[t] = (dispatched[t] ?? 0) + 1;
    } catch (e) {
      /* preflight and the like carry no body */
    }
  });

  // There is no <form>, so Enter submits nothing — the button has to be
  // clicked, and it is the one that says Login rather than the fullscreen
  // control that sits on every page.
  await page.goto(`${BASE}/account/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button.submit:has-text("Login")');
  await page
    .waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
    .catch(() => {
      report.loginFailed = true;
    });

  await page
    .goto(`${BASE}/p/${ORG}/${PROJECT}/editor`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    .catch((e) => {
      report.navigationError = e.message;
    });

  // An organization idles out; the board is behind that button when it has.
  await page.waitForTimeout(6000);
  if ((await ask(page, () => /shut down due to inactivity/.test(document.body.innerText))) === true) {
    await page.click('button:has-text("Start Organization")').catch(() => {});
    await page.waitForTimeout(20000);
  }

  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    ready = await ask(page, () => !!document.querySelector('.excalidraw'), 8000).catch(
      () => false
    );
    if (ready !== true) await page.waitForTimeout(2000);
  }
  report.surfaceUp = ready === true;

  // Excalidraw only builds a container for an embed it is drawing, so nothing
  // can be read off the scene until the scene is on screen. The click first is
  // only to give the canvas the keyboard, and it lands on an empty corner
  // because clicking an embed puts the click inside the node.
  const empty = await ask(page, () => {
    const c = document.querySelector('.excalidraw canvas.interactive');
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { x: b.right - 80, y: b.bottom - 140 };
  });
  if (empty?.x) {
    await page.mouse.click(empty.x, empty.y).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Shift+Digit1').catch(() => undefined);
  await page.waitForTimeout(5000);

  /** What each embedded node currently does with a pointer. */
  const pointers = () =>
    ask(page, () =>
      [...document.querySelectorAll('[data-testid=embedded-node]')].map((e) => ({
        type: e.dataset.nodeType,
        pointerEvents: e.style.pointerEvents || '(unset)',
      }))
    );

  report.default = await pointers();

  // Shift+Z is the board's move mode. It was once guarded by "is ReactFlow the
  // active layer", which made it dead on the drawing surface — the failure
  // this script exists to catch.
  await page.keyboard.press('Shift+Z');
  await page.waitForTimeout(800);
  report.moveMode = await pointers();

  // Still in move mode: drag a node and see whether the graph hears about it.
  const box = await ask(page, () => {
    const el = document.querySelector('[data-testid=embedded-node]');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  dispatched = {};
  if (box?.x) {
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 70, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(2500);
  }
  report.dragDispatched = dispatched;

  await page.keyboard.press('Shift+Z');
  await page.waitForTimeout(800);
  report.backToDefault = await pointers();

  const live = (s) => s?.every((n) => n.pointerEvents === 'auto');
  const released = (s) => s?.every((n) => n.pointerEvents === 'none');
  report.verdict =
    report.default?.length &&
    live(report.default) &&
    released(report.moveMode) &&
    live(report.backToDefault) &&
    report.dragDispatched['whiteboard:move-node']
      ? 'PASS'
      : 'FAIL';

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
  return report.verdict === 'PASS' ? 0 : 1;
};

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
