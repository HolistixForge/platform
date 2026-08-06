import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Every `url()` in these stylesheets points at a file that is there.
 *
 * The node backgrounds are reached with a six-level relative walk into a
 * sibling package — `../../../../../../ui-base/src/lib/assets/…` — which is
 * correct today and depends on the on-disk depth of this one directory and on
 * ui-base's internal layout. Both are things a refactor moves without thinking
 * about a stylesheet.
 *
 * The reason that matters more here than usual: a `background-image` whose
 * file is missing paints nothing and reports nothing. No console error, no
 * build warning, no failing test — the node just looks flat, and only someone
 * who remembers what it used to look like notices. These paths had already
 * been broken that way once.
 *
 * So the traversal stays, and this makes it loud.
 */

const CSS_DIR = __dirname;
const URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

const stylesheets = readdirSync(CSS_DIR).filter((f) => f.endsWith('.scss'));

describe('whiteboard stylesheet assets', () => {
  it('has stylesheets to check', () => {
    expect(stylesheets.length).toBeGreaterThan(0);
  });

  it.each(stylesheets)('%s references only files that exist', (file) => {
    const path = join(CSS_DIR, file);
    // Comments out first. These files explain the paths they use, quoting
    // wrong ones — the very thing this looks for.
    const source = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');

    const missing: string[] = [];
    for (const [, target] of source.matchAll(URL_RE)) {
      // Data URIs, absolute URLs and bare package specifiers are somebody
      // else's to resolve; only the relative walks are checked here.
      if (!target.startsWith('.')) continue;
      const asset = resolve(dirname(path), target);
      if (!existsSync(asset)) missing.push(`${target} → ${asset}`);
    }

    expect(missing).toEqual([]);
  });
});
