import {
  elementKey,
  parseElementKey,
  TExcalidrawElementEntry,
} from './excalidraw-shared-model';
import {
  pickDrawingElements,
  sceneSignature,
  versionsById,
} from './excalidraw-scene';
// The sort lives with the layer that owns the scene, not with the scene
// helpers — it is the projection's last step, and the only place layers touch
// rendering at all.
import { byLayerOrder } from './layer';

const entry = (
  drawingId: string,
  id: string,
  index: string,
  version = 1
): [string, TExcalidrawElementEntry] => [
  elementKey(drawingId, id),
  { drawingId, element: { id, index, version } },
];

describe('element keys', () => {
  it('round-trips', () => {
    expect(parseElementKey(elementKey('d1', 'e1'))).toEqual({
      drawingId: 'd1',
      elementId: 'e1',
    });
  });

  it('splits on the first separator, so a strange element id cannot reassign the drawing', () => {
    expect(parseElementKey(elementKey('d1', 'e::1'))).toEqual({
      drawingId: 'd1',
      elementId: 'e::1',
    });
  });

  it('rejects a key with no separator, an empty drawing, or an empty element', () => {
    expect(parseElementKey('nope')).toBeUndefined();
    expect(parseElementKey('::e1')).toBeUndefined();
    expect(parseElementKey('d1::')).toBeUndefined();
  });
});

describe('pickDrawingElements', () => {
  it('returns only the asked drawing', () => {
    const picked = pickDrawingElements(
      [entry('d1', 'a', 'a1'), entry('d2', 'b', 'a1'), entry('d1', 'c', 'a2')],
      'd1'
    );
    expect(picked.map((e) => e['id'])).toEqual(['a', 'c']);
  });

  /**
   * The map is keyed, not ordered. Reading it back in whatever order it
   * yields would let a remote write restack a drawing behind the user.
   */
  it('sorts by Excalidraw fractional index, not by insertion', () => {
    const picked = pickDrawingElements(
      [entry('d1', 'last', 'a3'), entry('d1', 'first', 'a1')],
      'd1'
    );
    expect(picked.map((e) => e['id'])).toEqual(['first', 'last']);
  });

  it('is empty for an unknown drawing and for a missing id', () => {
    expect(pickDrawingElements([entry('d1', 'a', 'a1')], 'other')).toEqual([]);
    expect(pickDrawingElements([entry('d1', 'a', 'a1')], '')).toEqual([]);
  });
});

describe('versionsById', () => {
  it('maps id to version', () => {
    expect(
      versionsById([
        { id: 'a', version: 3 },
        { id: 'b', version: 7 },
      ])
    ).toEqual(
      new Map([
        ['a', 3],
        ['b', 7],
      ])
    );
  });

  it('skips an element with no id, and defaults a missing version', () => {
    const v = versionsById([{ version: 3 }, { id: 'b' }]);
    expect(v.size).toBe(1);
    expect(v.get('b')).toBe(0);
  });
});

//

describe('sceneSignature', () => {
  it('is stable for the same scene', () => {
    const scene = [
      { id: 'a', version: 1 },
      { id: 'b', version: 4 },
    ];
    expect(sceneSignature(scene)).toBe(sceneSignature([...scene]));
  });

  it('changes when an element is mutated', () => {
    const before = sceneSignature([{ id: 'a', version: 1 }]);
    const after = sceneSignature([{ id: 'a', version: 2 }]);
    expect(after).not.toBe(before);
  });

  it('changes when an element is deleted', () => {
    // Excalidraw tombstones rather than removes, so a deletion arrives as the
    // same id at the same version with a flag. Reading only id and version
    // would call that an unchanged scene and never report the removal.
    const before = sceneSignature([{ id: 'a', version: 1 }]);
    const after = sceneSignature([{ id: 'a', version: 1, isDeleted: true }]);
    expect(after).not.toBe(before);
  });

  it('changes when an element is added or removed', () => {
    const one = sceneSignature([{ id: 'a', version: 1 }]);
    const two = sceneSignature([
      { id: 'a', version: 1 },
      { id: 'b', version: 1 },
    ]);
    expect(two).not.toBe(one);
  });
});

/**
 * Layers, as the only thing a layer actually is.
 *
 * Excalidraw's scene array *is* the paint order, so stacking is a sort and
 * nothing else in the pipeline has to know layers exist. Which makes this the
 * one place the feature can be wrong quietly: a bad sort does not throw, it
 * just puts somebody's drawing behind somebody else's.
 */
describe('byLayerOrder', () => {
  const on = (id: string, layer?: string) => ({
    id,
    customData: layer ? { holistixLayer: layer } : undefined,
  });
  const stack = (...ids: string[]) => ids.map((id) => ({ id }));
  const ids = (els: { id: string }[]) => els.map((e) => e.id);

  it('paints the back layer first and the front one last', () => {
    const sorted = byLayerOrder(
      [on('front', 'l2'), on('back', 'l1')],
      stack('l1', 'l2')
    );

    expect(ids(sorted)).toEqual(['back', 'front']);
  });

  it('follows the stack rather than the order of the array', () => {
    // The same elements, the stack reversed: the answer must reverse too, or
    // dragging a layer in the panel would change nothing on the board.
    const elements = [on('a', 'l1'), on('b', 'l2')];

    expect(ids(byLayerOrder(elements, stack('l1', 'l2')))).toEqual(['a', 'b']);
    expect(ids(byLayerOrder(elements, stack('l2', 'l1')))).toEqual(['b', 'a']);
  });

  it('keeps the order elements already had within one layer', () => {
    // Excalidraw's own bring-to-front works on that order, so a sort that
    // shuffled within a layer would silently undo it.
    const sorted = byLayerOrder(
      [on('1', 'l1'), on('2', 'l1'), on('3', 'l1')],
      stack('l1', 'l2')
    );

    expect(ids(sorted)).toEqual(['1', '2', '3']);
  });

  it('puts an element with no layer at the bottom', () => {
    // Where it was when the bottom was the only place there was. A board that
    // predates layers is unchanged, and needs no migration.
    const sorted = byLayerOrder(
      [on('tagged', 'l1'), on('untagged')],
      stack('l1', 'l2')
    );

    expect(ids(sorted)).toEqual(['untagged', 'tagged']);
  });

  it('puts an element on a layer nobody knows at the bottom too', () => {
    // A layer somebody deleted, or one from a newer client. Guessing a
    // position for it would move drawings around on a stale build.
    const sorted = byLayerOrder(
      [on('known', 'l1'), on('orphan', 'gone')],
      stack('l1', 'l2')
    );

    expect(ids(sorted)).toEqual(['orphan', 'known']);
  });

  it('leaves the scene exactly alone when there is one layer', () => {
    // The common case, and the one where a sort could only cost something.
    const elements = [on('a', 'l1'), on('b'), on('c', 'l1')];

    expect(byLayerOrder(elements, stack('l1'))).toBe(elements);
  });

  it('leaves it alone when there are none', () => {
    const elements = [on('a'), on('b')];

    expect(byLayerOrder(elements, [])).toBe(elements);
  });
});
