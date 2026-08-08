/**
 * Load a project's board and report what the Excalidraw surface actually does.
 *
 * A headless browser of its own, because the one being driven by hand is a
 * shared resource: a board that locks its renderer takes the whole browser
 * with it, and then neither the freeze nor the fix can be observed. This one
 * is disposable — it is launched, asked one question and closed.
 *
 *   node scripts/local-dev/check-excalidraw-surface.mjs [--surface] [--nodes]
 *
 * `--surface` opens on the drawing surface, `--nodes` projects the graph's
 * nodes into it; both are off by default, matching the app.
 */
import { chromium } from 'playwright';

const BASE = process.env.HOLISTIX_BASE ?? 'https://apollo.test:8443';
const ORG = process.env.HOLISTIX_ORG ?? '5b927daf-4ca8-45a7-adbe-32bce35988f7';
const PROJECT = process.env.HOLISTIX_PROJECT ?? 'sync-test';
const EMAIL = process.env.HOLISTIX_EMAIL ?? 'claude@test.local';
const PASSWORD = process.env.HOLISTIX_PASSWORD ?? 'TestUser123!';

const wantSurface = process.argv.includes('--surface');
const wantNodes = process.argv.includes('--nodes');

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

  const report = { surface: wantSurface, nodes: wantNodes };

  // A blank board is usually a thrown error, and the message is the whole
  // diagnosis. Collected rather than inferred.
  report.pageErrors = [];
  page.on('pageerror', (e) => {
    if (report.pageErrors.length < 4) report.pageErrors.push(String(e.message).slice(0, 200));
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (report.pageErrors.length < 4)
      report.pageErrors.push(m.text().slice(0, 200));
  });

  await page.goto(`${BASE}/account/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  // There is no <form>, so Enter submits nothing — the button has to be
  // clicked, and it is the one that says Login rather than the fullscreen
  // control that sits on every page.
  await page.click('button.submit:has-text("Login")');
  await page
    .waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
    .catch(() => {
      report.loginFailed = true;
    });

  // The switches live in localStorage, so they are set on the origin before
  // the board is opened rather than by rebuilding between attempts.
  await page.evaluate(
    ([s, n]) => {
      if (s) localStorage.setItem('holistix:excalidraw-surface', '1');
      else localStorage.removeItem('holistix:excalidraw-surface');
      if (n) localStorage.setItem('holistix:excalidraw-nodes', '1');
      else localStorage.removeItem('holistix:excalidraw-nodes');
    },
    [wantSurface, wantNodes]
  );

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
  const needsStart = await ask(page, () =>
    /shut down due to inactivity/.test(document.body.innerText)
  );
  if (needsStart === true) {
    await page.click('button:has-text("Start Organization")').catch(() => {});
    await page.waitForTimeout(15000);
  }

  // Poll rather than sleep: the surface path was reported as frozen when it
  // was only slow, and the difference matters.
  const deadline = Date.now() + 45000;
  let settled = false;
  while (Date.now() < deadline && !settled) {
    settled = await ask(
      page,
      () =>
        !!document.querySelector('.excalidraw') ||
        !!document.querySelector('.react-flow'),
      8000
    ).catch(() => false);
    if (settled !== true) await page.waitForTimeout(2000);
  }
  report.settledInMs = settled === true ? Date.now() - (deadline - 45000) : null;

  /** What the board shows right now. */
  const snapshot = () =>
    ask(page, () => ({
      alive: true,
      reactflow: !!document.querySelector('.react-flow'),
      excalidraw: !!document.querySelector('.excalidraw'),
      embedContainers: document.querySelectorAll(
        '.excalidraw__embeddable-container'
      ).length,
      renderedNodes: [
        ...document.querySelectorAll('.excalidraw__embeddable__outer'),
      ].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
      diagnostics: [
        ...document.querySelectorAll('[data-testid=embedded-node-error]'),
      ].map((e) => e.textContent.trim()),
      blank: document.body.innerText.trim() === '',
    }));

  report.beforeFit = await snapshot();

  // Excalidraw only builds a container for an embeddable it is drawing, so the
  // scene is brought into view before the count is taken. Reported separately
  // from the state before it, because a page that dies here dies of the fit
  // and not of the projection.
  if (wantSurface) {
    await page.keyboard.press('Shift+Digit1').catch((e) => {
      report.fitError = e.message;
    });
    await page.waitForTimeout(4000);
    report.afterFit = await snapshot();
  }

  Object.assign(
    report,
    await ask(page, () => ({
      alive: true,
      reactflow: !!document.querySelector('.react-flow'),
      excalidraw: !!document.querySelector('.excalidraw'),
      embedContainers: document.querySelectorAll(
        '.excalidraw__embeddable-container'
      ).length,
      renderedNodes: [
        ...document.querySelectorAll('.excalidraw__embeddable__outer'),
      ].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
      diagnostics: [
        ...document.querySelectorAll('[data-testid=embedded-node-error]'),
      ].map((e) => e.textContent.trim()),
      url: location.pathname,
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 100),
    }))
  );

  const shot = process.argv.find((a) => a.startsWith('--shot='));
  if (shot) {
    const path = shot.slice('--shot='.length);
    await page.screenshot({ path }).catch(() => {});
    report.screenshot = path;
  }

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
  process.exit(report.frozen ? 1 : 0);
};

main().catch((e) => {
  console.error(JSON.stringify({ fatal: e.message }, null, 1));
  process.exit(2);
});
