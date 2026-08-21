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
 * nodes into it. Both are the app's default; without the flags this checks
 * the board as it was, which is what the escape hatches give a user.
 */
import { chromium } from 'playwright';

const BASE = process.env.HOLISTIX_BASE ?? 'https://apollo.test:8443';
const ORG = process.env.HOLISTIX_ORG ?? '5b927daf-4ca8-45a7-adbe-32bce35988f7';
const PROJECT = process.env.HOLISTIX_PROJECT ?? 'sync-test';
const EMAIL = process.env.HOLISTIX_EMAIL ?? 'claude@test.local';
const PASSWORD = process.env.HOLISTIX_PASSWORD ?? 'TestUser123!';

/** `--peer` opens a second browser on the same board, as the second account. */
const wantPeer = process.argv.includes('--peer');
const wantSurface = process.argv.includes('--surface');
const wantNodes = process.argv.includes('--nodes');
/** `--generate=N` tops the board up to N shape nodes before measuring. */
const generateTo = Number(
  (process.argv.find((a) => a.startsWith('--generate=')) ?? '').split('=')[1] ??
    0
);

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
  // Every event the board dispatches, by type. The surface is supposed to
  // send a move back to the graph, and this is the only place that shows it
  // without trusting the DOM to have caught up.
  report.dispatched = {};
  page.on('request', (r) => {
    if (!r.url().includes('/collab/event')) return;
    try {
      const body = JSON.parse(r.postData() ?? '{}');
      const t = body?.event?.type;
      if (t) report.dispatched[t] = (report.dispatched[t] ?? 0) + 1;
    } catch (e) {
      /* preflight and the like carry no body */
    }
  });

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
      // Both are on by default now, so the flags turn them *off*.
      if (s) localStorage.removeItem('holistix:excalidraw-surface');
      else localStorage.setItem('holistix:excalidraw-surface', '0');
      if (n) localStorage.removeItem('holistix:excalidraw-nodes');
      else localStorage.setItem('holistix:excalidraw-nodes', '0');
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
      graphNodes: document.querySelectorAll('.react-flow__node').length,
      domNodes: document.querySelectorAll('*').length,
      heapMB: performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : null,
    }));

  if (generateTo) {
    // Through the real event, `whiteboard:new-shape`, using the app's own
    // dispatcher — reached through the React tree rather than reimplemented,
    // so the auth and the project id are the app's and not a copy of them.
    report.generated = await page.evaluate(async (target) => {
      const rootEl = [...document.querySelectorAll('*')].find((el) =>
        Object.keys(el).some((k) => k.startsWith('__reactFiber$'))
      );
      if (!rootEl) return { error: 'no react tree' };
      let f = rootEl[Object.keys(rootEl).find((k) => k.startsWith('__reactFiber$'))];
      while (f?.return) f = f.return;

      let dispatcher = null;
      const seenObj = new WeakSet();
      const scan = (o, d) => {
        if (!o || d > 4 || typeof o !== 'object' || seenObj.has(o) || dispatcher)
          return;
        seenObj.add(o);
        if ('_project_id' in o && typeof o.dispatch === 'function') {
          dispatcher = o;
          return;
        }
        for (const k of Object.keys(o)) {
          try {
            scan(o[k], d + 1);
          } catch (e) {
            /* getters that throw */
          }
        }
      };
      const stack = [f];
      const seenFiber = new WeakSet();
      let guard = 0;
      while (stack.length && guard++ < 40000 && !dispatcher) {
        const fb = stack.pop();
        if (!fb || seenFiber.has(fb)) continue;
        seenFiber.add(fb);
        scan(fb.memoizedProps, 0);
        scan(fb.memoizedState, 0);
        if (fb.child) stack.push(fb.child);
        if (fb.sibling) stack.push(fb.sibling);
      }
      if (!dispatcher) return { error: 'no dispatcher' };

      const have = document.querySelectorAll('.react-flow__node').length;
      const missing = Math.max(0, target - have);
      if (!missing) return { have, added: 0 };

      const COLS = 40;
      const GAP = 220;
      const jobs = [];
      for (let i = 0; i < missing; i++) {
        const k = have + i;
        jobs.push({ x: (k % COLS) * GAP, y: Math.floor(k / COLS) * GAP });
      }

      let added = 0;
      let failed = 0;
      const workers = Array.from({ length: 12 }, async () => {
        while (jobs.length) {
          const j = jobs.pop();
          if (!j) break;
          try {
            await dispatcher.dispatch({
              type: 'whiteboard:new-shape',
              shapeId: crypto.randomUUID(),
              shapeType: 'circle',
              origin: { viewId: 'view-1', position: j },
            });
            added++;
          } catch (e) {
            failed++;
          }
        }
      });
      await Promise.all(workers);
      return { have, added, failed };
    }, generateTo);

    // The graph has to come back through collab before it can be projected.
    await page.waitForTimeout(8000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(15000);
  }

  report.beforeFit = await snapshot();

  // Excalidraw only builds a container for an embeddable it is drawing, so the
  // scene is brought into view before the count is taken. Reported separately
  // from the state before it, because a page that dies here dies of the fit
  // and not of the projection.
  if (wantSurface) {
    // The shortcut goes to whatever has focus, so the canvas is given it
    // first — on an empty corner, because clicking an embed puts the click
    // inside the node rendered in it.
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
    await page.keyboard.press('Shift+Digit1').catch((e) => {
      report.fitError = e.message;
    });
    await page.waitForTimeout(5000);
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

  // Drag the first projected node and see whether the graph followed. The
  // whole point of the surface is that moving a node there moves the node.
  if (process.argv.includes('--drag')) {
    // A real mouse, not synthesised events: Excalidraw's own hit testing runs
    // on trusted input, and the embed's centre belongs to the node inside it
    // — so the grab is on the element's edge, which is the canvas.
    const target = await ask(page, () => {
      // Clear of the layers panel on the left and of the toolbar on top —
      // grabbing at x=53 landed on the panel and moved nothing.
      const c = [...document.querySelectorAll('.excalidraw__embeddable-container')]
        .map((el) => ({ el, b: el.getBoundingClientRect() }))
        .filter(
          ({ b }) =>
            b.left > 360 &&
            b.top > 180 &&
            b.right < window.innerWidth - 120 &&
            b.bottom < window.innerHeight - 120
        )
        .sort((p, q) => p.b.left - q.b.left)[0]?.el;
      if (!c) return null;
      const b = c.getBoundingClientRect();
      const nodeEl = document.querySelector('.react-flow__node');
      return {
        edgeX: b.left + 3,
        edgeY: b.top + b.height / 2,
        probeId: nodeEl?.getAttribute('data-id') ?? null,
        probeBefore: nodeEl?.style.transform ?? null,
      };
    });

    if (target && target.edgeX) {
      await page.mouse.move(target.edgeX, target.edgeY);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(target.edgeX + i * 10, target.edgeY + i * 7);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(8000);
      report.drag = { grabbedAt: [target.edgeX, target.edgeY] };
      report.afterDrag = await snapshot();
    } else {
      report.drag = { error: 'nothing projected in view' };
    }
  }

  if (process.argv.includes('--probe')) {
    report.probe = await ask(page, () => {
      const rootEl = [...document.querySelectorAll('*')].find((el) =>
        Object.keys(el).some((k) => k.startsWith('__reactFiber$'))
      );
      let f = rootEl?.[Object.keys(rootEl).find((k) => k.startsWith('__reactFiber$'))];
      while (f?.return) f = f.return;
      let sd = null;
      const seen = new WeakSet();
      const scan = (o, d) => {
        if (!o || d > 4 || typeof o !== 'object' || seen.has(o) || sd) return;
        seen.add(o);
        if (typeof o.getData === 'function') {
          try {
            const got = o.getData();
            if (got && got['whiteboard:graphViews']) sd = got;
          } catch (e) { /* */ }
        }
        for (const k of Object.keys(o)) { try { scan(o[k], d + 1); } catch (e) { /* */ } }
      };
      const st = [f]; const sf = new WeakSet(); let g = 0;
      while (st.length && g++ < 40000 && !sd) {
        const fb = st.pop(); if (!fb || sf.has(fb)) continue; sf.add(fb);
        scan(fb.memoizedProps, 0); scan(fb.memoizedState, 0);
        if (fb.child) st.push(fb.child); if (fb.sibling) st.push(fb.sibling);
      }
      if (!sd) return { error: 'no shared data' };
      const gv = sd['whiteboard:graphViews']?.get('view-1');
      const nodes = gv?.graph?.nodes ?? [];
      return {
        hasGraph: !!gv?.graph,
        nodeCount: nodes.length,
        firstNode: nodes[0]
          ? {
              id: String(nodes[0].id).slice(0, 10),
              type: nodes[0].type,
              keys: Object.keys(nodes[0]),
              data: JSON.parse(JSON.stringify(nodes[0].data ?? null)),
            }
          : null,
        nodeViewCount: (gv?.nodeViews ?? []).length,
      };
    });
  }

  // The decisive scenario of TAC-211: a node in the scene, clicked, opening
  // its service in a tab. Two clicks, because Excalidraw keeps its canvas over
  // an embed until that embed is the active one — the first click activates,
  // the second reaches the node.
  if (process.argv.includes('--open-service')) {
    const spot = await ask(page, () => {
      const withNode = [
        ...document.querySelectorAll('.excalidraw__embeddable-container'),
      ].find((c) => (c.textContent || '').trim().length > 0);
      if (!withNode) return null;
      const b = withNode.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });

    if (!spot?.x) {
      report.openService = { error: 'no node rendered in view' };
    } else {
      await page.evaluate(
        (w) => ((window.__wantedButton = w), undefined),
        process.env.HOLISTIX_BUTTON ?? ''
      );
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(1200);

      report.openService = await ask(page, () => {
        const c = [
          ...document.querySelectorAll('.excalidraw__embeddable-container'),
        ].find((x) => (x.textContent || '').trim().length > 0);
        const buttons = [...(c?.querySelectorAll('button') ?? [])].map((b) =>
          (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24)
        );
        const reachable =
          document.elementFromPoint(
            (c?.getBoundingClientRect().left ?? 0) + 20,
            (c?.getBoundingClientRect().top ?? 0) + 20
          )?.tagName ?? null;
        return { buttons, reachable };
      });

      // The card opens its service on a click on the card itself, not on a
      // button — server-card.tsx puts the handler on the card's own div. The
      // element is clicked directly rather than hunting for a pixel no button
      // covers, which found none on a card this size.
      const card = page
        .locator('.gradient-notebook-card, .node-background')
        .first();
      if (await card.count().catch(() => 0)) {
        await card
          .click({ position: { x: 10, y: 10 }, timeout: 8000 })
          .catch((e) => {
            report.cardClickError = String(e.message).slice(0, 120);
          });
        await page.waitForTimeout(5000);
        report.cardClicked = true;
      } else {
        report.cardClicked = false;
      }

      // Click whichever button the card offers for its service.
      // Passed in, not read from process.env: this runs in the page.
      const clicked = await ask(page, () => {
        const c = [
          ...document.querySelectorAll('.excalidraw__embeddable-container'),
        ].find((x) => (x.textContent || '').trim().length > 0);
        // Never the destructive ones: a loose /service/i matched "Stop this
        // service" and stopped a running notebook.
        const label = (x) =>
          ((x.textContent || '') + ' ' + (x.getAttribute('aria-label') || '') +
            ' ' + (x.title || '')).trim();
        const wanted = window.__wantedButton;
        const b = [...(c?.querySelectorAll('button') ?? [])].find((x) => {
          const t = label(x);
          if (wanted) return t.toLowerCase().includes(wanted.toLowerCase());
          if (/stop|delete|remove/i.test(t)) return false;
          return /open|jupyter|lab|notebook/i.test(t);
        });
        if (!b) return { error: 'no service button on the card' };
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      if (clicked?.x) {
        await page.mouse.click(clicked.x, clicked.y);
        await page.waitForTimeout(4000);
        report.openService.clickedAt = [clicked.x, clicked.y];
      } else {
        report.openService.clickError = clicked;
      }
      report.afterOpen = await snapshot();
    }
  }

  // A second person on the same board. The surface has to be the same scene
  // for both and each has to see the other — collaboration is not a property
  // of one client.
  if (wantPeer) {
    const peer = await browser.newContext({ ignoreHTTPSErrors: true });
    const peerPage = await peer.newPage();
    await peerPage.goto(`${BASE}/account/login`, {
      waitUntil: 'domcontentloaded',
    });
    // The second test account does not exist on the macOS path — its
    // bootstrap script only knows /root/.local-dev — so the peer is the same
    // person in another browser. That still shows one scene shared by two
    // clients; it does not show two *people* seeing each other.
    await peerPage.fill(
      'input[type=email]',
      process.env.HOLISTIX_PEER_EMAIL ?? EMAIL
    );
    await peerPage.fill('input[type=password]', PASSWORD);
    await peerPage.click('button.submit:has-text("Login")');
    await peerPage
      .waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
      .catch(() => undefined);
    // Home first, then the board. Going straight to the board after logging
    // in asked for the organisation's projects before the session could
    // answer for them and came back 403 — which reads exactly like a missing
    // permission and is not one: the same call succeeds a moment later.
    await peerPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await peerPage.waitForTimeout(9000);
    await peerPage.goto(`${BASE}/p/${ORG}/${PROJECT}/editor`, {
      waitUntil: 'domcontentloaded',
    });
    await peerPage.waitForTimeout(8000);
    // The same idle-out the first client handles.
    const peerNeedsStart = await peerPage
      .evaluate(() => /shut down due to inactivity/.test(document.body.innerText))
      .catch(() => false);
    if (peerNeedsStart) {
      await peerPage
        .click('button:has-text("Start Organization")')
        .catch(() => undefined);
      await peerPage.waitForTimeout(15000);
    }
    // Poll rather than sleep: the board takes as long as it takes.
    for (let i = 0; i < 12; i++) {
      const up = await peerPage
        .evaluate(() => !!document.querySelector('.excalidraw'))
        .catch(() => false);
      if (up) break;
      await peerPage.waitForTimeout(3000);
    }

    report.peer = await Promise.race([
      peerPage.evaluate(() => ({
        excalidraw: !!document.querySelector('.excalidraw'),
        embeds: document.querySelectorAll('.excalidraw__embeddable-container')
          .length,
        blank: document.body.innerText.trim() === '',
        url: location.pathname,
        text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
      })),
      new Promise((r) => setTimeout(() => r({ frozen: true }), 15000)),
    ]);

    // Each side counts the avatars the other's presence puts on the board.
    report.peerAwareness = {
      here: await ask(page, () =>
        document.querySelectorAll('[class*=avatar]').length
      ),
      there: await Promise.race([
        peerPage.evaluate(
          () => document.querySelectorAll('[class*=avatar]').length
        ),
        new Promise((r) => setTimeout(() => r('timeout'), 10000)),
      ]),
    };
    await peer.close();
  }

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
