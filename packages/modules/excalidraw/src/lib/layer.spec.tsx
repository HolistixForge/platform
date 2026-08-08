/**
 * @jest-environment jsdom
 *
 * The layer answers Excalidraw's onChange without answering itself.
 *
 * This is the regression that took the whole editor down: onChange fires for
 * `appState` too — including the viewport writes this layer makes — so a
 * handler that reports to the whiteboard on every call re-renders the tree
 * that re-renders it. React stopped it with "maximum update depth exceeded",
 * from whichever component happened to hold a Radix popper, which made it look
 * like a third-party bug rather than a missing guard here.
 *
 * The reducer suites that came with the same change all pass against this bug:
 * they exercise the shared data, and nothing about the shared data is wrong.
 * The defect is in the React wiring, so the test has to mount the component.
 */
import { render, act } from '@testing-library/react';

import { ExcalidrawLayerComponent } from './layer';

//

/** Captures Excalidraw's props so a test can drive onChange by hand. */
let mockCapturedOnChange: ((elements: unknown[]) => void) | null = null;

jest.mock('@excalidraw/excalidraw/index.css', () => ({}), { virtual: true });

/** The scene the fake Excalidraw holds, so `pull` can read it back. */
let mockScene: { id: string; version: number }[] = [];

jest.mock(
  '@excalidraw/excalidraw',
  () => ({
    __esModule: true,
    Excalidraw: (props: {
      onChange?: (e: unknown[]) => void;
      excalidrawAPI?: (api: unknown) => void;
    }) => {
      mockCapturedOnChange = props.onChange ?? null;
      props.excalidrawAPI?.({
        updateScene: (s: { elements?: { id: string; version: number }[] }) => {
          mockUpdateSceneCalls++;
          if (s.elements) mockScene = s.elements;
        },
        getAppState: () => ({}),
        getSceneElementsIncludingDeleted: () => mockScene,
      });
      return null;
    },
    // The real one returns the union of local and remote, which is the whole
    // point of the regression below: a local element the flush has not sent
    // yet is in there too.
    reconcileElements: (local: { id: string }[], remote: { id: string }[]) => {
      const byId = new Map(local.map((e) => [e.id, e]));
      remote.forEach((e) => byId.set(e.id, e));
      return [...byId.values()];
    },
    // Anything but equal, so `pull` does not take its early return.
    getSceneVersion: (els: unknown[]) => els.length,
    getCommonBounds: () => [0, 0, 0, 0],
    convertToExcalidrawElements: (skeletons: unknown[]) =>
      skeletons.map((sk, i) => ({
        ...(sk as object),
        id: `gen-${i}`,
        version: 1,
      })),
    restoreElements: (els: unknown) => els,
  }),
  { virtual: true }
);

//

const mockUpdateLayerTree = jest.fn();
const mockDispatch = jest.fn().mockResolvedValue(undefined);

// Every hook here returns the same object on every call. A fresh one per
// render would change the component's effect dependencies each time and make
// its cleanup re-run — which reports an empty tree and would be counted here
// as a report. The real hooks are stable; a mock that is not would measure the
// mock.
const mockLayerContext = { updateLayerTree: mockUpdateLayerTree };
const mockDispatcher = { dispatch: mockDispatch };
/** What the shared map currently holds, keyed as the real one keys it. */
const mockRemote = new Map<
  string,
  { element: { id: string; version: number } }
>();
/** The layer's own observer, so a test can play a remote change arriving. */
let mockOnRemoteChange: (() => void) | null = null;

const mockSharedData = {
  'excalidraw:elements': {
    forEach: (
      fn: (
        entry: { element: { id: string; version: number } },
        key: string
      ) => void
    ) => mockRemote.forEach((entry, key) => fn(entry, key)),
    observe: (cb: () => void) => {
      mockOnRemoteChange = cb;
    },
    unobserve: () => {
      mockOnRemoteChange = null;
    },
  },
};
const mockUsers: unknown[] = [];

/** Node views the layer should project into the scene. Set per test. */
let mockNodeViews: { id: string; position: { x: number; y: number } }[] = [];
const mockGraphView = () =>
  mockNodeViews.length
    ? { nodeViews: mockNodeViews.map((nv) => ({ ...nv, status: {} })) }
    : undefined;

/** Counts the layer's scene writes, so a runaway shows up as a number. */
let mockUpdateSceneCalls = 0;

jest.mock('@holistix-forge/whiteboard/frontend', () => ({
  useLayerContext: () => mockLayerContext,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwarenessUserList: () => mockUsers,
  useSharedDataDirect: () => mockSharedData,
  // The graph view the layer projects into the scene. A *fresh object on every
  // call*, which is what the real hook does — the layer must not read that
  // identity as a change, or it re-projects forever.
  useLocalSharedData: () => mockGraphView(),
}));

jest.mock('@holistix-forge/reducers/frontend', () => ({
  useDispatcher: () => mockDispatcher,
}));

//

const element = (id: string, version: number) => ({
  id,
  version,
  type: 'rectangle',
  x: 0,
  y: 0,
  isDeleted: false,
});

const viewport = {
  registerViewportChangeCallback: () => () => undefined,
  onViewportChange: () => undefined,
  getViewport: () => ({ absoluteX: 0, absoluteY: 0, zoom: 1 }),
};

const mount = async () => {
  await act(async () => {
    render(
      <ExcalidrawLayerComponent
        viewId="view-1"
        active={true}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewport={viewport as any}
        payload={{ nodeId: 'drawing-1', viewId: 'view-1' }}
      />
    );
  });
};

//

describe('ExcalidrawLayerComponent', () => {
  beforeEach(() => {
    mockCapturedOnChange = null;
    mockOnRemoteChange = null;
    mockScene = [];
    mockNodeViews = [];
    mockUpdateSceneCalls = 0;
    mockRemote.clear();
    mockUpdateLayerTree.mockClear();
    mockDispatch.mockClear();
  });

  //

  it('projects the graph’s nodes without re-projecting on every change', async () => {
    // The freeze this pins down: the projection effect depended on the array
    // the graph-view hook returns, that hook returns a fresh one on every
    // call, and the projection itself causes a call. The tab locked up, which
    // costs a reload to even see — hence a test rather than another attempt.
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      // The drawing and the projection are a couple of writes. A loop is not.
      expect(mockUpdateSceneCalls).toBeLessThan(5);

      // And the element carries an id derived from the node, not a fresh one:
      // Excalidraw caches an embeddable's validation by id and never evicts
      // it, so a new id per projection grows that map without bound.
      const projected = mockScene.filter((e) =>
        String(e.id).startsWith('holistix-node-')
      );
      expect(projected).toHaveLength(1);
      expect(projected[0].id).toBe('holistix-node-node-a');
    } finally {
      localStorage.removeItem('holistix:excalidraw-nodes');
    }
  });

  it('sends a node that was moved on the surface back to the graph', async () => {
    jest.useFakeTimers();
    mockNodeViews = [{ id: 'node-a', position: { x: 10, y: 20 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      // Someone drags it. Excalidraw reports the new box through onChange.
      const moved = {
        ...mockScene.find((e) => String(e.id).startsWith('holistix-node-')),
        x: 300,
        y: 400,
        version: 9,
      };
      act(() => {
        mockCapturedOnChange?.([moved]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      const moves = mockDispatch.mock.calls
        .map(([e]) => e)
        .filter((e) => e?.type === 'whiteboard:move-node');

      expect(moves).toHaveLength(1);
      expect(moves[0]).toMatchObject({
        nid: 'node-a',
        viewId: 'view-1',
        position: { x: 300, y: 400 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not read its own projection back as a move', async () => {
    // The projection writes the graph's position into the scene. Excalidraw
    // reports that as a change like any other, and dispatching it would send
    // the position straight home again — every time, forever.
    jest.useFakeTimers();
    mockNodeViews = [{ id: 'node-a', position: { x: 10, y: 20 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        mockCapturedOnChange?.([...mockScene]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      const geometry = mockDispatch.mock.calls
        .map(([e]) => e)
        .filter(
          (e) =>
            e?.type === 'whiteboard:move-node' ||
            e?.type === 'whiteboard:resize-node'
        );

      expect(geometry).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('projects nothing when a user has turned the projection off', async () => {
    localStorage.setItem('holistix:excalidraw-nodes', '0');
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        mockScene.filter((e) => String(e.id).startsWith('holistix-node-'))
      ).toHaveLength(0);
    } finally {
      localStorage.removeItem('holistix:excalidraw-nodes');
    }
  });

  it('still sends a stroke drawn just before someone else’s change arrives', async () => {
    // The 250 ms debounce is the window this happens in: the stroke is
    // recorded locally, a remote change lands, and the flush runs after.
    jest.useFakeTimers();
    try {
      await mount();

      // Someone draws. `flush` is now pending, nothing dispatched yet.
      const mine = element('mine', 1);
      mockScene = [mine];
      act(() => {
        mockCapturedOnChange?.([mine]);
      });

      // Their change lands inside the window.
      mockRemote.set('drawing-1::theirs', { element: element('theirs', 4) });
      await act(async () => {
        mockOnRemoteChange?.();
        await Promise.resolve();
      });

      // The debounce fires.
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      const upserts = mockDispatch.mock.calls
        .map(([e]) => e)
        .filter((e) => e?.type === 'excalidraw:upsert-elements')
        .flatMap((e) => e.elements as { id: string }[]);

      // Recording the whole reconciliation as "sent" marked this element as
      // already saved, and it was never written — lost for everyone else and
      // gone after a reload.
      expect(upserts.map((e) => e.id)).toContain('mine');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports the layer tree once for a scene that has not changed', async () => {
    await mount();
    expect(mockCapturedOnChange).toBeTruthy();

    const scene = [element('a', 1)];

    // Three calls, one scene. Excalidraw really does this: any appState change
    // — a scroll, a zoom, a tool switch — comes through the same callback.
    await act(async () => {
      mockCapturedOnChange?.(scene);
      mockCapturedOnChange?.(scene);
      mockCapturedOnChange?.(scene);
    });

    expect(mockUpdateLayerTree).toHaveBeenCalledTimes(1);
  });

  it('reports again once an element actually changes', async () => {
    await mount();

    await act(async () => {
      mockCapturedOnChange?.([element('a', 1)]);
      mockCapturedOnChange?.([element('a', 2)]);
    });

    expect(mockUpdateLayerTree).toHaveBeenCalledTimes(2);
  });

  it('reports again when an element is deleted', async () => {
    await mount();

    await act(async () => {
      mockCapturedOnChange?.([element('a', 1)]);
      mockCapturedOnChange?.([{ ...element('a', 1), isDeleted: true }]);
    });

    expect(mockUpdateLayerTree).toHaveBeenCalledTimes(2);
  });
});
