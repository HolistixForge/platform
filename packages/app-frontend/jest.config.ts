/**
 * app-frontend had specs and no way to run them: Nx infers the `test` target
 * from this file, so without it `nx run app-frontend:test` answered "Cannot
 * find configuration for task" and the specs ran neither locally nor in CI.
 *
 * Same shape as the other React packages (ui-base, ui-toolkit, the module
 * packages) — the @nx/react babel transform, jsdom from the preset.
 */
export default {
  displayName: 'app-frontend',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: 'test-output/jest/coverage',
};
