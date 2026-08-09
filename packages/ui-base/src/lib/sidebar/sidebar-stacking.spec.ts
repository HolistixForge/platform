import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The rail has to stay on top of whatever the page draws.
 *
 * `position: fixed` does not do that on its own. With no z-index the rail
 * paints at the same level as the page's own content, so anything positive
 * above it covers it — and the whiteboard's drawing surface is a full-screen
 * canvas at 10. The rail went on being rendered, correctly placed and fully
 * hidden, which is the worst way for a thing to break: there is nothing to
 * see and nothing in the console.
 *
 * Read from the stylesheet rather than from a rendered component, because
 * jsdom applies no external CSS and a `getComputedStyle` here would report
 * the default whatever the file said. The ordering is checked across two
 * files, which is the part a person cannot hold in their head: the tier the
 * rail asks for, and what that tier is worth.
 */
const css = readFileSync(join(__dirname, 'sidebar.css'), 'utf8');
const variables = readFileSync(
  join(__dirname, '..', 'assets', 'css', 'variables.scss'),
  'utf8'
);

/** The highest `zIndexHint` any whiteboard layer declares — the surface's. */
const HIGHEST_LAYER_Z = 10;

const tierValue = (name: string): number => {
  const found = new RegExp(`--${name}\\s*:\\s*(-?\\d+)`).exec(variables);
  if (!found) throw new Error(`--${name} is not defined in variables.scss`);
  return Number(found[1]);
};

/** The `aside { … }` block, which is where every variant gets its position. */
const asideRule = /aside\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

describe('the project rail, in the stack', () => {
  it('is positioned out of flow, so nothing gives way to it', () => {
    expect(asideRule).toMatch(/position:\s*fixed/);
  });

  it('asks for a z-index rather than leaving it to paint order', () => {
    expect(asideRule).toMatch(/z-index:\s*var\(--z-sticky\)/);
  });

  it('asks for a tier above every whiteboard layer', () => {
    expect(tierValue('z-sticky')).toBeGreaterThan(HIGHEST_LAYER_Z);
  });

  it('stays under the things that should open over it', () => {
    // A dropdown, a modal or a toast opening behind the rail would be the
    // same failure the other way round.
    expect(tierValue('z-sticky')).toBeLessThan(tierValue('z-modal'));
    expect(tierValue('z-sticky')).toBeLessThan(tierValue('z-toast'));
  });
});
