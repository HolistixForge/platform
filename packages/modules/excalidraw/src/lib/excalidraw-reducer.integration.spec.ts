/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The reducer against a real Yjs document, not a stand-in map.
 *
 * The unit tests use a plain `Map`, which agrees with the shared-map contract
 * on every point that happens to be easy. Yjs does not: it deep-converts what
 * it stores, it has its own view of iteration while mutating, and it is the
 * thing that actually has to converge between two clients. This exercises the
 * real one, and the two-document cases are the closest we get to two people
 * drawing at the same time without standing up a gateway.
 */

import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import { YjsSharedTypes } from '@holistix-forge/collab-engine';

import { ExcalidrawReducer } from './excalidraw-reducer';
import {
  elementKey,
  TExcalidrawElementEntry,
  TExcalidrawLegacyDrawing,
} from './excalidraw-shared-model';

const PROJECT_ID = 'project-1';
const DRAWING = 'drawing-a';

const requestData = { project_id: PROJECT_ID, user_id: 'system' } as any;

const element = (id: string, version = 1, extra: Record<string, any> = {}) => ({
  id,
  version,
  type: 'rectangle',
  index: `a${id}`,
  ...extra,
});

/** A reducer bound to one document, the way the gateway binds one per room. */
const reducerOn = (doc: Doc) => {
  const shared = new YjsSharedTypes(doc);
  const sharedData = {
    'excalidraw:elements': shared.getSharedMap<TExcalidrawElementEntry>(
      'excalidraw:elements'
    ),
    'excalidraw:drawing':
      shared.getSharedMap<TExcalidrawLegacyDrawing>('excalidraw:drawing'),
  };

  const depsExports = {
    collab: {
      registry: {
        getCollabForProject: () => ({ sharedData }),
        registerSharedData: () => undefined,
      },
    },
  };

  return {
    reducer: new ExcalidrawReducer(depsExports as any),
    sharedData,
  };
};

/** What y-websocket does between two clients, without the socket. */
const sync = (a: Doc, b: Doc) => {
  applyUpdate(b, encodeStateAsUpdate(a));
  applyUpdate(a, encodeStateAsUpdate(b));
};

describe('ExcalidrawReducer on a real Yjs document', () => {
  it('stores an element and reads it back through the shared map', async () => {
    const doc = new Doc();
    const { reducer, sharedData } = reducerOn(doc);

    await reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: DRAWING,
        elements: [element('e1', 1, { x: 5 })],
      },
      requestData
    );

    expect(
      sharedData['excalidraw:elements'].get(elementKey(DRAWING, 'e1'))?.element
    ).toMatchObject({ id: 'e1', x: 5 });
  });

  /**
   * The bug this whole change exists for, played out on two documents that
   * only ever exchange updates — no shared memory, no last writer.
   */
  it('converges when two clients edit two elements at once', async () => {
    const alice = new Doc();
    const bob = new Doc();

    const a = reducerOn(alice);
    const b = reducerOn(bob);

    // Both start from the same two elements.
    await a.reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: DRAWING,
        elements: [element('e1'), element('e2')],
      },
      requestData
    );
    sync(alice, bob);

    // Then each edits a different one, offline from the other.
    await a.reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: DRAWING,
        elements: [element('e1', 2, { x: 10 })],
      },
      requestData
    );
    await b.reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: DRAWING,
        elements: [element('e2', 2, { x: 99 })],
      },
      requestData
    );

    sync(alice, bob);

    for (const side of [a, b]) {
      const map = side.sharedData['excalidraw:elements'];
      expect(map.get(elementKey(DRAWING, 'e1'))?.element).toMatchObject({
        x: 10,
      });
      expect(map.get(elementKey(DRAWING, 'e2'))?.element).toMatchObject({
        x: 99,
      });
    }
  });

  it('deletes a whole drawing while iterating the real map', async () => {
    const doc = new Doc();
    const { reducer, sharedData } = reducerOn(doc);

    await reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: DRAWING,
        elements: [element('e1'), element('e2'), element('e3')],
      },
      requestData
    );
    await reducer.reduce(
      {
        type: 'excalidraw:upsert-elements',
        drawingId: 'other',
        elements: [element('e4')],
      },
      requestData
    );

    await reducer.reduce(
      { type: 'excalidraw:delete-drawing', drawingId: DRAWING },
      requestData
    );

    const left: string[] = [];
    sharedData['excalidraw:elements'].forEach((_v, k) => left.push(k));
    expect(left).toEqual([elementKey('other', 'e4')]);
  });

  describe('migration', () => {
    const init = {
      type: 'project:init' as const,
      project_id: PROJECT_ID,
      systemEvent: true as const,
    };

    it('moves a legacy drawing across and consumes it', async () => {
      const doc = new Doc();
      const { reducer, sharedData } = reducerOn(doc);

      sharedData['excalidraw:drawing'].set(DRAWING, {
        elements: [element('e1'), element('e2')],
        fromUser: 'someone',
        svg: '<svg/>',
      } as any);

      await reducer.reduce(init, requestData);

      expect(
        sharedData['excalidraw:elements'].get(elementKey(DRAWING, 'e1'))
      ).toBeDefined();
      expect(sharedData['excalidraw:drawing'].get(DRAWING)).toBeUndefined();
    });

    it('is idempotent across a reload of the same document', async () => {
      const doc = new Doc();
      const first = reducerOn(doc);

      first.sharedData['excalidraw:drawing'].set(DRAWING, {
        elements: [element('e1')],
        fromUser: 'someone',
        svg: '',
      } as any);

      await first.reducer.reduce(init, requestData);

      // A second room start on the same document — a restart, or the snapshot
      // being reapplied — must not duplicate anything.
      const reloaded = new Doc();
      applyUpdate(reloaded, encodeStateAsUpdate(doc));
      const second = reducerOn(reloaded);
      await second.reducer.reduce(init, requestData);

      const keys: string[] = [];
      second.sharedData['excalidraw:elements'].forEach((_v, k) => keys.push(k));
      expect(keys).toEqual([elementKey(DRAWING, 'e1')]);
    });

    it('keeps the stacking order of a drawing that had no index', async () => {
      const doc = new Doc();
      const { reducer, sharedData } = reducerOn(doc);

      // No `index` anywhere: order lived in the array.
      sharedData['excalidraw:drawing'].set(DRAWING, {
        elements: [
          { id: 'bottom', version: 1, type: 'rectangle' },
          { id: 'middle', version: 1, type: 'rectangle' },
          { id: 'top', version: 1, type: 'rectangle' },
        ],
        fromUser: 'someone',
        svg: '',
      } as any);

      await reducer.reduce(init, requestData);

      const indexOf = (id: string) =>
        sharedData['excalidraw:elements'].get(elementKey(DRAWING, id))?.element[
          'index'
        ] as string;

      expect(indexOf('bottom') < indexOf('middle')).toBe(true);
      expect(indexOf('middle') < indexOf('top')).toBe(true);
    });
  });
});
