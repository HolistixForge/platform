/// <reference types='vite/client' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath } from 'node:url';

/**
 * Vite configuration for the workspace-wide Storybook.
 *
 * No path aliases are needed: the packages are npm workspaces and resolve
 * through their `exports` field in node_modules, the same way application code
 * imports them. That does mean a package has to be built (`dist/` present)
 * before its stylesheet import — `@holistix-forge/ui-base/style` — resolves.
 */
const fsShim = fileURLToPath(new URL('./fs-shim.js', import.meta.url));

export default defineConfig({
  define: {
    // JupyterLab's packages are built for webpack and read this global to
    // resolve their own chunks at runtime. Vite defines no such thing, so the
    // module threw a ReferenceError on evaluation and took the Jupyter Main
    // and Terminal stories with it, before either could render.
    //
    // An empty string is what webpack itself uses when assets sit at the
    // server root, which is where Storybook serves them from. Nothing here
    // splits chunks the way those packages expect anyway; the value only has
    // to exist.
    __webpack_public_path__: '""',
  },
  plugins: [
    react(),
    // Several modules pull in libraries that expect Node globals in the
    // browser; the per-package Vite configs polyfill them too.
    // `fs` is overridden rather than aliased: the plugin resolves the node
    // builtins itself, so a `resolve.alias` entry never gets a look in. See
    // fs-shim.js for why an empty module is not good enough.
    nodePolyfills({ overrides: { fs: fsShim } }),
  ],
});
