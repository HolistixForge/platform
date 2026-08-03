/// <reference types='vite/client' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Vite configuration for the workspace-wide Storybook.
 *
 * No path aliases are needed: the packages are npm workspaces and resolve
 * through their `exports` field in node_modules, the same way application code
 * imports them. That does mean a package has to be built (`dist/` present)
 * before its stylesheet import — `@holistix-forge/ui-base/style` — resolves.
 */
export default defineConfig({
  plugins: [
    react(),
    // Several modules pull in libraries that expect Node globals in the
    // browser; the per-package Vite configs polyfill them too.
    nodePolyfills(),
  ],
});
