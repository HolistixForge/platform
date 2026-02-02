const { toMatchImageSnapshot } = require('jest-image-snapshot');

module.exports = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
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

    // Wait for renders to settle
    await page.waitForTimeout(500);

    // Screenshot only the rendered component (not Storybook chrome)
    const root = page.locator('#storybook-root');

    // Wait for the element to be visible before screenshotting
    try {
      await root.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // If the root isn't visible (e.g. dialog stories), screenshot the whole page
      const screenshot = await page.screenshot();
      expect(screenshot).toMatchImageSnapshot({
        failureThreshold: 0.002,
        failureThresholdType: 'percent',
        customSnapshotsDir: process.env['SNAPSHOT_DIR'] || '__screenshots__',
        customSnapshotIdentifier: context.id,
        customDiffDir: process.env['DIFF_DIR'] || '__diff_output__',
      });
      return;
    }

    const screenshot = await root.screenshot();

    expect(screenshot).toMatchImageSnapshot({
      failureThreshold: 0.002, // 0.2% pixel difference allowed
      failureThresholdType: 'percent',
      customSnapshotsDir: process.env['SNAPSHOT_DIR'] || '__screenshots__',
      customSnapshotIdentifier: context.id,
      customDiffDir: process.env['DIFF_DIR'] || '__diff_output__',
    });
  },
};
