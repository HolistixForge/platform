const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // Runs before the test framework is installed, which is what the jsdom
  // globals in jest.setup.js need: they have to exist before a spec's imports
  // are evaluated, not before its first test.
  setupFiles: [...(nxPreset.setupFiles ?? []), require.resolve('./jest.setup')],
};
