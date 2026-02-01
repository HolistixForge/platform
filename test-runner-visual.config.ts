import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

const config: TestRunnerConfig = {
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

    // Wait for any pending renders to settle
    await page.waitForTimeout(300);

    // Screenshot only the rendered component (not Storybook chrome)
    const root = page.locator('#storybook-root');
    const screenshot = await root.screenshot();

    expect(screenshot).toMatchImageSnapshot({
      failureThreshold: 0.002, // 0.2% pixel difference allowed
      failureThresholdType: 'percent',
      customSnapshotsDir: `${process.env['SNAPSHOT_DIR'] || '__screenshots__'}`,
      customSnapshotIdentifier: context.id,
      customDiffDir: `${process.env['DIFF_DIR'] || '__diff_output__'}`,
    });
  },
};

export default config;
