/// <reference types='vite/client' />
import { defineConfig, createLogger } from 'vite';
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

/**
 * Vite's own logger, minus one warning Storybook prints on every start and
 * every reload.
 *
 * `@storybook/builder-vite` generates its entry with
 *
 *   import.meta.hot.accept('/virtual:/@storybook/builder-vite/storybook-stories.js', …)
 *
 * The module it names really exists, but its id begins with a NUL byte — the
 * convention Rollup uses to mark a virtual module — and the string in the
 * generated code does not. So `vite:import-analysis` looks for a module under
 * a name nothing is registered under, cannot find it, and says so. Storybook
 * accepts the update through its own channel regardless; the warning describes
 * a lookup that was never going to succeed and never needed to.
 *
 * Filtered rather than fixed because the code is generated inside
 * @storybook/builder-vite 8.5. Fixing it means upgrading Storybook, which is
 * its own piece of work — and the warning is worth removing on its own, since
 * a message that appears every single start teaches people to ignore the log,
 * and the next real warning goes with it.
 *
 * Deliberately narrow: it matches this one virtual id and nothing else, so any
 * other unresolved import still reaches you.
 */
const logger = createLogger();
const warn = logger.warn;
logger.warn = (msg, options) => {
  if (msg.includes('builder-vite/storybook-stories.js')) return;
  warn(msg, options);
};

export default defineConfig({
  customLogger: logger,

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
