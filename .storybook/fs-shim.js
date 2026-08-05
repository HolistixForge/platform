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
export const statSync = nothing;
export const mkdirSync = nothing;
export const readdirSync = () => [];
export const promises = {};

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  readdirSync,
  promises,
};
