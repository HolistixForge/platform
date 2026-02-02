const path = require('path');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

const PKG_ROOT = path.resolve(__dirname, '..');

const SNAPSHOT_OPTS = {
  failureThreshold: 0.002, // 0.2% pixel difference allowed
  failureThresholdType: 'percent',
  customSnapshotsDir:
    process.env['SNAPSHOT_DIR'] || path.join(PKG_ROOT, '__screenshots__'),
  customDiffDir:
    process.env['DIFF_DIR'] || path.join(PKG_ROOT, '__diff_output__'),
};

/**
 * Wait for the page to be ready without relying on networkidle
 * (which times out when stories load external resources like avatars).
 */
async function waitUntilReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  // Small settle time for React re-renders
  await page.waitForTimeout(300);
}

module.exports = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },

  async preVisit(page) {
    // Block external image requests to prevent navigation context destruction.
    // Stories load random avatars from pravatar.cc which cause flaky test failures.
    await page.route('**/*pravatar*/**', (route) => route.abort());
    await page.route('**/*.pravatar.*/**', (route) => route.abort());
  },

  async postVisit(page, context) {
    // Disable CSS animations/transitions to avoid flaky diffs
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Wait for page to be ready (DOM, resources, fonts — skip networkidle)
    await waitUntilReady(page);

    const root = page.locator('#storybook-root');

    try {
      await root.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Root not visible — fall back to full page screenshot
      const screenshot = await page.screenshot();
      expect(screenshot).toMatchImageSnapshot({
        ...SNAPSHOT_OPTS,
        customSnapshotIdentifier: context.id,
      });
      return;
    }

    // Check if a Radix dialog portal is present (renders outside #storybook-root)
    const dialogContent = page.locator('[data-radix-portal] [role="dialog"]');
    const hasDialog = await dialogContent.count().then((c) => c > 0);

    if (hasDialog) {
      // Screenshot the dialog content instead of the empty root
      try {
        await dialogContent
          .first()
          .waitFor({ state: 'visible', timeout: 3000 });
        const screenshot = await dialogContent.first().screenshot();
        expect(screenshot).toMatchImageSnapshot({
          ...SNAPSHOT_OPTS,
          customSnapshotIdentifier: context.id,
        });
        return;
      } catch {
        // Dialog not visible, fall through to page screenshot
      }
    }

    // Check if root content is too small (likely clipped by overflow)
    const box = await root.boundingBox();
    if (box && (box.width < 10 || box.height < 10)) {
      // Component is too small to be meaningful — screenshot full page
      const screenshot = await page.screenshot();
      expect(screenshot).toMatchImageSnapshot({
        ...SNAPSHOT_OPTS,
        customSnapshotIdentifier: context.id,
      });
      return;
    }

    const screenshot = await root.screenshot();
    expect(screenshot).toMatchImageSnapshot({
      ...SNAPSHOT_OPTS,
      customSnapshotIdentifier: context.id,
    });
  },
};
