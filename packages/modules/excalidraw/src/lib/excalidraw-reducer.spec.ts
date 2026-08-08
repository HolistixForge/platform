/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ExcalidrawReducer tests.
 *
 * The module had no reducer at all until now — the browser wrote to Yjs
 * directly — so these are also the first assertions that anything on the
 * server owns a drawing.
 */

import { ExcalidrawReducer } from './excalidraw-reducer';
import { TExcalidrawElementEntry, elementKey } from './excalidraw-shared-model';

const PROJECT_ID = 'project-1';
const DRAWING = 'drawing-a';
const OTHER_DRAWING = 'drawing-b';

const requestData = { project_id: PROJECT_ID, user_id: 'system' } as any;

const element = (id: string, version = 1, extra: Record<string, any> = {}) => ({
  id,
  version,
  type: 'rectangle',
  ...extra,
});

/** A stand-in for a shared map: the four methods the reducer uses. */
const fakeSharedMap = <T>(store: Map<string, T>) => ({
  get: (k: string) => store.get(k),
  set: (k: string, v: T) => store.set(k, v),
  delete: (k: string) => store.delete(k),
  forEach: (f: (v: T, k: string) => void) => store.forEach((v, k) => f(v, k)),
  copy: () => new Map(store),
});

describe('ExcalidrawReducer', () => {
  let reducer: ExcalidrawReducer;
  let store: Map<string, TExcalidrawElementEntry>;
  let legacyStore: Map<string, any>;

  beforeEach(() => {
    store = new Map();
    legacyStore = new Map();

    const depsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'excalidraw:elements': fakeSharedMap(store),
              'excalidraw:drawing': fakeSharedMap(legacyStore),
            },
          })),
          registerSharedData: jest.fn(),
        },
      },
    };

    reducer = new ExcalidrawReducer(depsExports as any);
  });

  describe('upsert-elements', () => {
    it('writes one key per element', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1'), element('e2')],
        },
        requestData
      );

      expect(store.size).toBe(2);
      expect(store.get(elementKey(DRAWING, 'e1'))).toEqual({
        drawingId: DRAWING,
        element: element('e1'),
      });
    });

    it('replaces only the element it is given', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1'), element('e2')],
        },
        requestData
      );

      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1', 2, { x: 40 })],
        },
        requestData
      );

      expect(store.get(elementKey(DRAWING, 'e1'))?.element).toMatchObject({
        version: 2,
        x: 40,
      });
      expect(store.get(elementKey(DRAWING, 'e2'))?.element).toMatchObject({
        version: 1,
      });
    });

    /**
     * The regression this whole change exists for. The drawing used to be a
     * single entry, so the second writer replaced the first one's scene: the
     * only conflict resolution was last-writer-wins over everything.
     */
    it('keeps both edits when two people change two elements', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1'), element('e2')],
        },
        requestData
      );

      // Two clients, interleaved, each touching its own element.
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1', 2, { x: 10 })],
        },
        requestData
      );
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e2', 2, { x: 99 })],
        },
        requestData
      );

      expect(store.get(elementKey(DRAWING, 'e1'))?.element).toMatchObject({
        x: 10,
      });
      expect(store.get(elementKey(DRAWING, 'e2'))?.element).toMatchObject({
        x: 99,
      });
    });

    it('drops an element with no id rather than inventing a key for it', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [{ version: 1 } as any, element('e1')],
        },
        requestData
      );

      expect(store.size).toBe(1);
      expect(store.has(elementKey(DRAWING, 'e1'))).toBe(true);
    });

    it('keeps drawings apart under the same element id', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('shared-id', 1, { x: 1 })],
        },
        requestData
      );
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: OTHER_DRAWING,
          elements: [element('shared-id', 1, { x: 2 })],
        },
        requestData
      );

      expect(store.size).toBe(2);
      expect(
        store.get(elementKey(DRAWING, 'shared-id'))?.element
      ).toMatchObject({ x: 1 });
      expect(
        store.get(elementKey(OTHER_DRAWING, 'shared-id'))?.element
      ).toMatchObject({ x: 2 });
    });
  });

  describe('delete-elements', () => {
    it('removes only the named elements', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1'), element('e2')],
        },
        requestData
      );

      await reducer.reduce(
        {
          type: 'excalidraw:delete-elements',
          drawingId: DRAWING,
          elementIds: ['e1'],
        },
        requestData
      );

      expect(store.has(elementKey(DRAWING, 'e1'))).toBe(false);
      expect(store.has(elementKey(DRAWING, 'e2'))).toBe(true);
    });
  });

  describe('delete-drawing', () => {
    it('removes every element of that drawing and nothing else', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: DRAWING,
          elements: [element('e1'), element('e2')],
        },
        requestData
      );
      await reducer.reduce(
        {
          type: 'excalidraw:upsert-elements',
          drawingId: OTHER_DRAWING,
          elements: [element('e3')],
        },
        requestData
      );

      await reducer.reduce(
        { type: 'excalidraw:delete-drawing', drawingId: DRAWING },
        requestData
      );

      expect(store.size).toBe(1);
      expect(store.has(elementKey(OTHER_DRAWING, 'e3'))).toBe(true);
    });
  });

  it('ignores an event it does not handle', async () => {
    await reducer.reduce({ type: 'something:else' } as any, requestData);
    expect(store.size).toBe(0);
  });

  /**
   * Migration of drawings written in the one-entry-per-drawing shape.
   *
   * Idempotent by construction: each drawing is deleted as it is moved, and
   * the keys are derived from the data, so a second run has nothing to move
   * and a racing run writes the same keys with the same values.
   */
  describe('project:init migration', () => {
    const init = {
      type: 'project:init' as const,
      project_id: PROJECT_ID,
      systemEvent: true as const,
    };

    it('moves each element across and consumes the drawing', async () => {
      legacyStore.set(DRAWING, {
        elements: [
          element('e1', 1, { index: 'a1' }),
          element('e2', 1, { index: 'a2' }),
        ],
        fromUser: 'someone',
        svg: '<svg/>',
      });

      await reducer.reduce(init, requestData);

      expect(store.size).toBe(2);
      expect(store.get(elementKey(DRAWING, 'e1'))?.drawingId).toBe(DRAWING);
      expect(legacyStore.size).toBe(0);
    });

    it('is idempotent: a second run changes nothing', async () => {
      legacyStore.set(DRAWING, {
        elements: [element('e1', 1, { index: 'a1' })],
        fromUser: 'someone',
        svg: '',
      });

      await reducer.reduce(init, requestData);
      const afterFirst = new Map(store);

      await reducer.reduce(init, requestData);

      expect(store).toEqual(afterFirst);
      expect(store.size).toBe(1);
    });

    /**
     * Order used to live in the array. The map has none, so a drawing written
     * before Excalidraw's fractional `index` existed would come back
     * restacked.
     */
    it('synthesizes a stacking index when the drawing has none', async () => {
      legacyStore.set(DRAWING, {
        elements: [element('bottom'), element('middle'), element('top')],
        fromUser: 'someone',
        svg: '',
      });

      await reducer.reduce(init, requestData);

      const indexOf = (id: string) =>
        store.get(elementKey(DRAWING, id))?.element['index'] as string;
      expect(indexOf('bottom') < indexOf('middle')).toBe(true);
      expect(indexOf('middle') < indexOf('top')).toBe(true);
    });

    it('leaves an existing index alone', async () => {
      legacyStore.set(DRAWING, {
        elements: [element('e1', 1, { index: 'zz9' })],
        fromUser: 'someone',
        svg: '',
      });

      await reducer.reduce(init, requestData);

      expect(store.get(elementKey(DRAWING, 'e1'))?.element['index']).toBe(
        'zz9'
      );
    });

    it('migrates several drawings and keeps them apart', async () => {
      legacyStore.set(DRAWING, {
        elements: [element('e1')],
        fromUser: 'a',
        svg: '',
      });
      legacyStore.set(OTHER_DRAWING, {
        elements: [element('e1')],
        fromUser: 'b',
        svg: '',
      });

      await reducer.reduce(init, requestData);

      expect(store.size).toBe(2);
      expect(store.has(elementKey(DRAWING, 'e1'))).toBe(true);
      expect(store.has(elementKey(OTHER_DRAWING, 'e1'))).toBe(true);
    });

    it('does nothing when there is nothing to migrate', async () => {
      await reducer.reduce(init, requestData);
      expect(store.size).toBe(0);
    });
  });
});
