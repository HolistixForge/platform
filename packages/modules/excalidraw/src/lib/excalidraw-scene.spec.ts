import {
  elementKey,
  parseElementKey,
  TExcalidrawElementEntry,
} from './excalidraw-shared-model';
import { pickDrawingElements, versionsById } from './excalidraw-scene';

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
