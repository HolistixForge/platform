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
  let viewStore: Map<string, any>;
  let layerStore: Map<string, any>;

  beforeEach(() => {
    store = new Map();
    legacyStore = new Map();
    viewStore = new Map();
    layerStore = new Map();

    const depsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'excalidraw:elements': fakeSharedMap(store),
              'excalidraw:drawing': fakeSharedMap(legacyStore),
              'excalidraw:layers': fakeSharedMap(layerStore),
              // whiteboard's, not this module's — the re-keying migration
              // reads it to learn which view held which node.
              'whiteboard:graphViews': fakeSharedMap(viewStore),
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

  describe('project:init — moving a node\u2019s drawing onto its view', () => {
    const init = { type: 'project:init' } as any;

    it('re-keys a drawing from the node that held it to the view', async () => {
      viewStore.set('view-1', { nodeViews: [{ id: 'node-a' }] });
      store.set(elementKey('node-a', 'e1'), {
        drawingId: 'node-a',
        element: element('e1'),
      });

      await reducer.reduce(init, requestData);

      expect(store.get(elementKey('node-a', 'e1'))).toBeUndefined();
      expect(store.get(elementKey('view-1', 'e1'))?.drawingId).toBe('view-1');
    });

    it('leaves a drawing that is already the view\u2019s alone', async () => {
      viewStore.set('view-1', { nodeViews: [] });
      store.set(elementKey('view-1', 'e1'), {
        drawingId: 'view-1',
        element: element('e1'),
      });

      await reducer.reduce(init, requestData);

      expect(store.get(elementKey('view-1', 'e1'))?.drawingId).toBe('view-1');
      expect(store.size).toBe(1);
    });

    it('merges two node drawings that sat on the same view', async () => {
      viewStore.set('view-1', {
        nodeViews: [{ id: 'node-a' }, { id: 'node-b' }],
      });
      store.set(elementKey('node-a', 'e1'), {
        drawingId: 'node-a',
        element: element('e1'),
      });
      store.set(elementKey('node-b', 'e2'), {
        drawingId: 'node-b',
        element: element('e2'),
      });

      await reducer.reduce(init, requestData);

      expect(store.get(elementKey('view-1', 'e1'))).toBeDefined();
      expect(store.get(elementKey('view-1', 'e2'))).toBeDefined();
      expect(store.size).toBe(2);
    });

    it('keeps a drawing whose node is in no view rather than guessing', async () => {
      // Unreachable is recoverable; misfiled is silently wrong.
      viewStore.set('view-1', { nodeViews: [] });
      store.set(elementKey('orphan', 'e1'), {
        drawingId: 'orphan',
        element: element('e1'),
      });

      await reducer.reduce(init, requestData);

      expect(store.get(elementKey('orphan', 'e1'))).toBeDefined();
    });

    it('is idempotent', async () => {
      viewStore.set('view-1', { nodeViews: [{ id: 'node-a' }] });
      store.set(elementKey('node-a', 'e1'), {
        drawingId: 'node-a',
        element: element('e1'),
      });

      await reducer.reduce(init, requestData);
      const after = new Map(store);
      await reducer.reduce(init, requestData);

      expect([...store.keys()].sort()).toEqual([...after.keys()].sort());
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

  /**
   * Layers are a stack, and the stack is shared.
   *
   * Excalidraw's scene is an ordered array and that order is the paint order,
   * so a layer is a contiguous block in it. Everything below is about the one
   * thing the browser cannot be trusted with: what the order *is*, when two
   * people are changing it.
   */
  describe('layers', () => {
    const on = (drawingId: string) =>
      Array.from(layerStore.values())
        .filter((l) => l.drawingId === drawingId)
        .sort((a, b) => a.order - b.order)
        .map((l) => l.id);

    const newLayer = (layerId: string, title = layerId, drawingId = 'd1') =>
      reducer.reduce(
        { type: 'excalidraw:new-layer', drawingId, layerId, title } as any,
        requestData
      );

    it('puts a new layer on top of the stack', async () => {
      await newLayer('a');
      await newLayer('b');

      expect(on('d1')).toEqual(['a', 'b']);
    });

    it('is idempotent, so a retry does not move a layer someone dragged', async () => {
      await newLayer('a');
      await newLayer('b');
      await reducer.reduce(
        {
          type: 'excalidraw:reorder-layers',
          drawingId: 'd1',
          layerIds: ['b', 'a'],
        } as any,
        requestData
      );

      await newLayer('a');

      expect(on('d1')).toEqual(['b', 'a']);
    });

    it('keeps one drawing’s stack out of another’s', async () => {
      await newLayer('a');
      await newLayer('x', 'x', 'd2');
      await newLayer('b');

      expect(on('d1')).toEqual(['a', 'b']);
      expect(on('d2')).toEqual(['x']);
    });

    it('reorders to exactly the list it was given', async () => {
      await newLayer('a');
      await newLayer('b');
      await newLayer('c');

      await reducer.reduce(
        {
          type: 'excalidraw:reorder-layers',
          drawingId: 'd1',
          layerIds: ['c', 'a', 'b'],
        } as any,
        requestData
      );

      expect(on('d1')).toEqual(['c', 'a', 'b']);
    });

    it('does not delete a layer missing from a stale list', async () => {
      // Someone reorders while a layer they have not seen yet exists. Losing
      // it would be a client deleting another client's work by omission.
      await newLayer('a');
      await newLayer('b');
      await newLayer('fresh');

      await reducer.reduce(
        {
          type: 'excalidraw:reorder-layers',
          drawingId: 'd1',
          layerIds: ['b', 'a'],
        } as any,
        requestData
      );

      expect(on('d1')).toContain('fresh');
      expect(on('d1')).toHaveLength(3);
    });

    it('ignores an id that is not a layer of this drawing', async () => {
      await newLayer('a');

      await reducer.reduce(
        {
          type: 'excalidraw:reorder-layers',
          drawingId: 'd1',
          layerIds: ['a', 'ghost'],
        } as any,
        requestData
      );

      expect(on('d1')).toEqual(['a']);
    });

    it('renames a layer', async () => {
      await newLayer('a', 'Layer 1');

      await reducer.reduce(
        {
          type: 'excalidraw:rename-layer',
          drawingId: 'd1',
          layerId: 'a',
          title: 'Annotations',
        } as any,
        requestData
      );

      expect(layerStore.get('d1::a').title).toBe('Annotations');
    });

    it('refuses a name that is only spaces', async () => {
      // Refused here rather than in the input, so it is true for every
      // client — including one running an older build.
      await newLayer('a', 'Layer 1');

      await reducer.reduce(
        {
          type: 'excalidraw:rename-layer',
          drawingId: 'd1',
          layerId: 'a',
          title: '   ',
        } as any,
        requestData
      );

      expect(layerStore.get('d1::a').title).toBe('Layer 1');
    });

    it('does nothing for a rename of a layer that is not there', async () => {
      await reducer.reduce(
        {
          type: 'excalidraw:rename-layer',
          drawingId: 'd1',
          layerId: 'ghost',
          title: 'x',
        } as any,
        requestData
      );

      expect(layerStore.size).toBe(0);
    });
  });
});
