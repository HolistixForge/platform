/**
 * Whether a node is open.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * Six lines, three callers — the reducer when it decides how far to walk, the
 * node wrapper when it decides what to draw, and the translation to ReactFlow
 * nodes. All three have to agree, which they only do because they all ask this
 * one function.
 *
 * The rule is not "the user opened it". It is a depth: a node is open while it
 * is nearer the roots than the view's `maxRank`, and the two force flags are
 * the user overriding that depth in either direction for one node. That is why
 * unfolding the graph by one rank opens a whole row of nodes at once, and why
 * a node the user closed by hand stays closed when the row around it opens.
 *
 * A drawing surface has no concept of a node being half-shown, so this is the
 * kind of behaviour a migration drops without failing.
 */
import { isNodeOpened, nodeViewDefaultStatus } from './whiteboard-types';
import type { TNodeViewStatus } from './whiteboard-types';

const status = (over: Partial<TNodeViewStatus> = {}): TNodeViewStatus => ({
  ...nodeViewDefaultStatus(),
  ...over,
});

describe('isNodeOpened', () => {
  it('opens a node nearer the roots than the view unfolds', () => {
    expect(isNodeOpened(status({ rank: 0, maxRank: 2 }))).toBe(true);
  });

  it('closes a node exactly at the edge of what the view unfolds', () => {
    // `rank < maxRank`, not `<=`: maxRank is how many strata are shown, so a
    // node at rank 2 is the third and outside a view showing two.
    expect(isNodeOpened(status({ rank: 2, maxRank: 2 }))).toBe(false);
  });

  it('closes a node beyond the edge', () => {
    expect(isNodeOpened(status({ rank: 5, maxRank: 2 }))).toBe(false);
  });

  it('opens nothing at all when the view unfolds no rank', () => {
    expect(isNodeOpened(status({ rank: 0, maxRank: 0 }))).toBe(false);
  });

  it('opens a node the user opened by hand, however deep it sits', () => {
    expect(
      isNodeOpened(status({ rank: 9, maxRank: 2, forceOpened: true }))
    ).toBe(true);
  });

  it('closes a node the user closed by hand, however near it sits', () => {
    expect(
      isNodeOpened(status({ rank: 0, maxRank: 2, forceClosed: true }))
    ).toBe(false);
  });

  it('lets forceOpened win when both flags are set', () => {
    // Reachable: forcing one open does not clear a stale forceClosed. The
    // order of the two branches is the whole of the tie-break, and nothing
    // else records it.
    expect(
      isNodeOpened(
        status({ rank: 5, maxRank: 2, forceOpened: true, forceClosed: true })
      )
    ).toBe(true);
  });
});

describe('a node view as it starts out', () => {
  it('is expanded, unforced, and one rank deep', () => {
    // What every node gets when it is first dropped on the board. A change
    // here changes how every new node appears, in every view.
    expect(nodeViewDefaultStatus()).toEqual({
      mode: 'EXPANDED',
      forceOpened: false,
      forceClosed: false,
      isFiltered: false,
      rank: 0,
      maxRank: 1,
    });
  });

  it('is open, since rank 0 is inside a view unfolding one rank', () => {
    expect(isNodeOpened(nodeViewDefaultStatus())).toBe(true);
  });

  it('is a fresh object each time, not one shared by every node', () => {
    // Shared, one node's mode would follow another's.
    expect(nodeViewDefaultStatus()).not.toBe(nodeViewDefaultStatus());
  });
});
