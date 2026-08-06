// A browser stand-in for `fs`.
//
// `vite-plugin-node-polyfills` maps `fs` to an empty module, and an empty
// module is `null` once required — so a dependency doing
// `const { existsSync } = require('fs')` throws "Cannot destructure property
// 'existsSync' of 'require_empty(...)' as it is null" before any component
// renders. Three Jupyter stories died that way: Main, Terminal and NewTerminal.
//
// Nothing in a story reads the filesystem; the imports come from libraries that
// branch on `existsSync` at module scope and take the browser path when it says
// no. So every function here answers "not there" rather than throwing, which is
// the answer that keeps that branch correct.
const notThere = () => false;
const nothing = () => undefined;

export const existsSync = notThere;
export const readFileSync = () => {
  throw new Error('fs.readFileSync is not available in the browser');
};
export const writeFileSync = nothing;
// Throws rather than answering `undefined`.
//
// `existsSync` returning false keeps the browser branch correct for anything
// that asks first. A library that does not ask — `statSync(p).isDirectory()`
// straight off — got `undefined` back and failed with "Cannot read properties
// of undefined (reading 'isDirectory')", which names neither this file nor the
// filesystem. `readFileSync` already fails the way that says where it came
// from; this now does too.
export const statSync = (path) => {
  throw new Error(`fs.statSync is not available in the browser (${path})`);
};
export const mkdirSync = nothing;
export const readdirSync = () => [];
// The same answers, promised.
//
// An empty object left `fs.promises.readFile` as `undefined`, so a dependency
// reaching for it died on "undefined is not a function" — naming neither this
// file nor the filesystem, which is the failure the throwing accessors above
// were written to stop.
export const promises = {
  readFile: async () => {
    throw new Error('fs.promises.readFile is not available in the browser');
  },
  stat: async (path) => {
    throw new Error(
      `fs.promises.stat is not available in the browser (${path})`
    );
  },
  access: async (path) => {
    throw new Error(
      `fs.promises.access is not available in the browser (${path})`
    );
  },
  writeFile: async () => undefined,
  mkdir: async () => undefined,
  readdir: async () => [],
};

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  readdirSync,
  promises,
};
