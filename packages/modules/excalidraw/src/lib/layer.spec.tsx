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

import { ExcalidrawLayerComponent, ownedAppState, nodeBoxSize } from './layer';

//

/** Captures Excalidraw's props so a test can drive onChange by hand. */
let mockCapturedOnChange:
  | ((elements: unknown[], appState?: unknown) => void)
  | null = null;

jest.mock('@excalidraw/excalidraw/index.css', () => ({}), { virtual: true });

/** The scene the fake Excalidraw holds, so `pull` can read it back. */
let mockScene: { id: string; version: number }[] = [];

jest.mock(
  '@excalidraw/excalidraw',
  () => ({
    __esModule: true,
    Excalidraw: (props: {
      onChange?: (e: unknown[], appState?: unknown) => void;
      excalidrawAPI?: (api: unknown) => void;
      initialData?: { appState?: Record<string, unknown> };
    }) => {
      mockCapturedOnChange = props.onChange ?? null;
      mockInitialAppState = props.initialData?.appState ?? null;
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
const mockUpdateLayerTrees = jest.fn();
const mockLayerContext = {
  updateLayerTree: mockUpdateLayerTree,
  updateLayerTrees: mockUpdateLayerTrees,
};
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

/** Selections the layer announces to the other people on the board. */
const mockEmitSelection = jest.fn();
const mockAwareness = {
  awareness: { emitSelectionAwareness: mockEmitSelection },
};

/** Node views the layer should project into the scene. Set per test. */
let mockNodeViews: {
  id: string;
  position: { x: number; y: number };
  parentId?: string;
}[] = [];
/** The graph's nodes behind those views. Set per test. */
let mockGraphNodes: { id: string; type: string; data?: unknown }[] = [];
const mockGraphView = () =>
  mockNodeViews.length
    ? { nodeViews: mockNodeViews.map((nv) => ({ ...nv, status: {} })) }
    : undefined;

/** `core-graph:nodes`, which is where a node's own data actually lives. */
const mockCoreNodes = () => ({
  forEach: (fn: (n: unknown, id: string) => void) =>
    mockGraphNodes.forEach((n) => fn(n, n.id)),
});

/** The graph's edges. Set per test. */
let mockEdges: { from: { node: string }; to: { node: string } }[] = [];
const mockCoreEdges = () => ({
  forEach: (fn: (e: unknown) => void) => mockEdges.forEach((e) => fn(e)),
});

/** The drawing's layers, back to front. Set per test. */
let mockLayers: {
  id: string;
  drawingId: string;
  title: string;
  order: number;
}[] = [];

/** Counts the layer's scene writes, so a runaway shows up as a number. */
let mockUpdateSceneCalls = 0;

/** The state the layer starts Excalidraw with. */
let mockInitialAppState: Record<string, unknown> | null = null;

jest.mock('@holistix-forge/whiteboard/frontend', () => ({
  useLayerContext: () => mockLayerContext,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwareness: () => mockAwareness,
  useAwarenessUserList: () => mockUsers,
  useSharedDataDirect: () => mockSharedData,
  // The graph view the layer projects into the scene. A *fresh object on every
  // call*, which is what the real hook does — the layer must not read that
  // identity as a change, or it re-projects forever.
  useLocalSharedData: (
    keys: string[],
    select?: (sd: Record<string, unknown>) => unknown
  ) => {
    if (keys?.[0] === 'core-graph:nodes') return mockCoreNodes();
    if (keys?.[0] === 'core-graph:edges') return mockCoreEdges();
    // The stack, and the one key whose *selector* is run rather than
    // bypassed: the filtering by drawing lives in it, and a mock that
    // answered with the raw list would let a test pass on another board's
    // layers.
    if (keys?.[0] === 'excalidraw:layers')
      return select?.({
        'excalidraw:layers': {
          forEach: (f: (l: unknown) => void) => mockLayers.forEach(f),
        },
      });
    return mockGraphView();
  },
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
    mockGraphNodes = [];
    mockEdges = [];
    mockLayers = [];
    mockUpdateSceneCalls = 0;
    mockInitialAppState = null;
    mockRemote.clear();
    mockUpdateLayerTree.mockClear();
    mockUpdateLayerTrees.mockClear();
    mockDispatch.mockClear();
    mockEmitSelection.mockClear();
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

  it('announces the nodes selected on the surface, and only those', async () => {
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    await mount();
    await act(async () => {
      await Promise.resolve();
    });
    mockEmitSelection.mockClear();

    const node = mockScene.find((e) =>
      String(e.id).startsWith('holistix-node-')
    );
    if (!node) throw new Error('nothing was projected');
    const stroke = element('a-stroke', 1);

    await act(async () => {
      mockCapturedOnChange?.([node, stroke], {
        selectedElementIds: { [node.id]: true, [stroke.id]: true },
      });
    });

    // The stroke is selected too, and is not announced: the graph has no word
    // for it.
    expect(mockEmitSelection).toHaveBeenCalledWith({
      nodes: ['node-a'],
      viewId: 'view-1',
    });
  });

  it('does not re-announce a selection that has not changed', async () => {
    // onChange fires for everything, and awareness goes to every peer.
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    await mount();
    await act(async () => {
      await Promise.resolve();
    });
    mockEmitSelection.mockClear();

    const node = mockScene.find((e) =>
      String(e.id).startsWith('holistix-node-')
    );
    if (!node) throw new Error('nothing was projected');
    const selection = { selectedElementIds: { [node.id]: true } };

    await act(async () => {
      mockCapturedOnChange?.([node], selection);
      mockCapturedOnChange?.([node], selection);
      mockCapturedOnChange?.([node], selection);
    });

    expect(mockEmitSelection).toHaveBeenCalledTimes(1);
  });

  it('draws a shape Excalidraw knows as a native element, not an embeddable', async () => {
    // A circle costs the scene an ellipse rather than a DOM subtree and a
    // React tree. Only the four shapes with a native equivalent qualify.
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    mockGraphNodes = [
      { id: 'node-a', type: 'shape', data: { shapeType: 'circle' } },
    ];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    const projected = mockScene.find((e) =>
      String(e.id).startsWith('holistix-node-')
    ) as unknown as { type: string; link?: string } | undefined;

    expect(projected?.type).toBe('ellipse');
    expect(projected?.link).toBeUndefined();
  });

  it('leaves a shape it has no native form for as an embeddable', async () => {
    // A hexagon has no Excalidraw equivalent, and drawing one as a polygon
    // would be a second rendering of what the node component already draws.
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    mockGraphNodes = [
      { id: 'node-a', type: 'shape', data: { shapeType: 'hexagon' } },
    ];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    const projected = mockScene.find((e) =>
      String(e.id).startsWith('holistix-node-')
    ) as unknown as { type: string; link?: string } | undefined;

    expect(projected?.type).toBe('embeddable');
    expect(projected?.link).toContain('node.holistix.invalid');
  });

  it('draws an edge as a native arrow bound to both nodes', async () => {
    // Binding is the canvas's job: an arrow bound to two elements stays
    // attached while either is dragged, which is what the phase-2 bet needs
    // and what nothing of ours would have to reimplement.
    mockNodeViews = [
      { id: 'node-a', position: { x: 0, y: 0 } },
      { id: 'node-b', position: { x: 600, y: 0 } },
    ];
    mockEdges = [{ from: { node: 'node-a' }, to: { node: 'node-b' } }];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    const arrow = mockScene.find(
      (e) => (e as unknown as { type?: string }).type === 'arrow'
    ) as unknown as
      | { start?: { id: string }; end?: { id: string } }
      | undefined;

    expect(arrow?.start?.id).toBe('holistix-node-node-a');
    expect(arrow?.end?.id).toBe('holistix-node-node-b');
  });

  it('skips an edge whose ends are not both on this view', async () => {
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    mockEdges = [{ from: { node: 'node-a' }, to: { node: 'elsewhere' } }];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      mockScene.filter(
        (e) => (e as unknown as { type?: string }).type === 'arrow'
      )
    ).toHaveLength(0);
  });

  it('deletes the node when its element is erased on the surface', async () => {
    jest.useFakeTimers();
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      // Excalidraw tombstones rather than removes.
      const gone = {
        ...mockScene.find((e) => String(e.id).startsWith('holistix-node-')),
        isDeleted: true,
        version: 9,
      };
      act(() => {
        mockCapturedOnChange?.([gone]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      const deletes = mockDispatch.mock.calls
        .map(([e]) => e)
        .filter((e) => e?.type === 'core:delete-node');

      expect(deletes).toEqual([{ type: 'core:delete-node', id: 'node-a' }]);

      // And not as a move as well: a tombstone still carries a box.
      expect(
        mockDispatch.mock.calls
          .map(([e]) => e)
          .filter((e) => e?.type === 'whiteboard:move-node')
      ).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('turns an arrow drawn between two nodes into an edge', async () => {
    jest.useFakeTimers();
    mockNodeViews = [
      { id: 'node-a', position: { x: 0, y: 0 } },
      { id: 'node-b', position: { x: 600, y: 0 } },
    ];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      // Excalidraw binds an arrow to whatever it lands on, so the ends are
      // already the two elements — no hit testing of our own.
      act(() => {
        mockCapturedOnChange?.([
          ...mockScene,
          {
            id: 'drawn-arrow',
            type: 'arrow',
            version: 1,
            startBinding: { elementId: 'holistix-node-node-a' },
            endBinding: { elementId: 'holistix-node-node-b' },
          },
        ]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      const edges = mockDispatch.mock.calls
        .map(([e]) => e)
        .filter((e) => e?.type === 'core:new-edge');

      expect(edges).toHaveLength(1);
      expect(edges[0].edge).toMatchObject({
        from: { node: 'node-a' },
        to: { node: 'node-b' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves an arrow with a loose end as a drawing', async () => {
    // Half-drawn, or joined to something someone sketched: that is not an
    // edge, and inventing one would put a relation in the graph nobody asked
    // for.
    jest.useFakeTimers();
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        mockCapturedOnChange?.([
          ...mockScene,
          {
            id: 'loose-arrow',
            type: 'arrow',
            version: 1,
            startBinding: { elementId: 'holistix-node-node-a' },
            endBinding: null,
          },
        ]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      expect(
        mockDispatch.mock.calls
          .map(([e]) => e)
          .filter((e) => e?.type === 'core:new-edge')
      ).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('draws a group as a frame, and puts its children in it', async () => {
    // A frame is Excalidraw's own word for "these belong together and move
    // together" — the name, the drag behaviour and the membership all come
    // with it, and none of them would with an embeddable.
    mockNodeViews = [
      { id: 'grp', position: { x: 0, y: 0 } },
      { id: 'node-a', position: { x: 20, y: 20 }, parentId: 'grp' },
    ];
    mockGraphNodes = [
      { id: 'grp', type: 'group', data: { title: 'Ideas' } },
      { id: 'node-a', type: 'shape', data: { shapeType: 'circle' } },
    ];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    const frame = mockScene.find(
      (e) => (e as unknown as { type?: string }).type === 'frame'
    ) as unknown as { name?: string; id: string } | undefined;
    const child = mockScene.find((e) => e.id === 'holistix-node-node-a') as
      | unknown as { frameId?: string } | undefined;

    expect(frame?.name).toBe('Ideas');
    expect(frame?.id).toBe('holistix-node-grp');
    expect(child?.frameId).toBe('holistix-node-grp');
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

    // Counted from after the mount, which publishes the stack once on its
    // own — a layer created in the panel has to reach it without waiting for
    // the next stroke. What is under test is the scene, so the baseline is
    // taken and the deltas are what matter.
    const before = mockUpdateLayerTrees.mock.calls.length;
    const scene = [element('a', 1)];

    // Three calls, one scene. Excalidraw really does this: any appState change
    // — a scroll, a zoom, a tool switch — comes through the same callback.
    await act(async () => {
      mockCapturedOnChange?.(scene);
      mockCapturedOnChange?.(scene);
      mockCapturedOnChange?.(scene);
    });

    expect(mockUpdateLayerTrees.mock.calls.length - before).toBe(1);
  });

  it('reports again once an element actually changes', async () => {
    await mount();
    const before = mockUpdateLayerTrees.mock.calls.length;

    await act(async () => {
      mockCapturedOnChange?.([element('a', 1)]);
      mockCapturedOnChange?.([element('a', 2)]);
    });

    expect(mockUpdateLayerTrees.mock.calls.length - before).toBe(2);
  });

  it('reports again when an element is deleted', async () => {
    await mount();
    const before = mockUpdateLayerTrees.mock.calls.length;

    await act(async () => {
      mockCapturedOnChange?.([element('a', 1)]);
      mockCapturedOnChange?.([{ ...element('a', 1), isDeleted: true }]);
    });

    expect(mockUpdateLayerTrees.mock.calls.length - before).toBe(2);
  });

  //

  describe('what a new element is drawn with', () => {
    it('starts white, because the board underneath is dark', async () => {
      // Excalidraw's own default is `#1e1e1e`, for its own white canvas. Ours
      // is transparent over a dark board, so that default drew strokes nobody
      // could see — which reads as a broken tool, not as a colour choice.
      await mount();

      expect(mockInitialAppState?.['currentItemStrokeColor']).toBe('#ffffff');
    });

    it('keeps the canvas transparent and the board in charge of the background', async () => {
      await mount();

      expect(mockInitialAppState?.['viewBackgroundColor']).toBe('transparent');
      expect(mockInitialAppState?.['viewModeEnabled']).toBe(false);
    });

    it('never pushes a colour back over the one the user picked', () => {
      // The layer re-applies the state it owns over the live one whenever the
      // collaborator list changes. A default living in there would be pushed
      // over the user's own colour every time someone joined or left the
      // board — mid-stroke. So the invariant is about which of the two objects
      // the default sits in, and that is what is asserted.
      expect(ownedAppState).not.toHaveProperty('currentItemStrokeColor');
      expect(ownedAppState).not.toHaveProperty('currentItemBackgroundColor');
    });
  });
});

//

describe('the box the scene gives a node', () => {
  it('adds the margin around the size the user chose', () => {
    // The margin is room around the node, not room taken out of it. Taken
    // out, a node the user had just dragged to fit came back clipped by
    // exactly the margin.
    expect(nodeBoxSize({ width: 500, height: 300 }, undefined)).toEqual({
      width: 516,
      height: 316,
    });
  });

  it('prefers the size the user chose over what the node measured', () => {
    expect(
      nodeBoxSize({ width: 500, height: 300 }, { width: 400, height: 260 })
    ).toEqual({ width: 516, height: 316 });
  });

  it('fits an unsized node to itself, with room on every side', () => {
    // The bug this fixes: a card 400 wide was drawn in a 320 box and cut off,
    // because the ReactFlow canvas sets no width on an unsized node and lets
    // it take the room it needs, while a scene element has to be given a box.
    expect(nodeBoxSize(undefined, { width: 400, height: 260 })).toEqual({
      width: 416,
      height: 276,
    });
  });

  it('falls back to a default until the node has been drawn once', () => {
    // Nothing to measure before the first paint. One frame at the wrong size
    // is unavoidable; staying there was the defect.
    expect(nodeBoxSize(undefined, undefined)).toEqual({
      width: 336,
      height: 236,
    });
  });

  it('takes each dimension from wherever it is known', () => {
    // A view can carry one and not the other, and the half that is missing
    // should still fit the node rather than fall to the default.
    expect(nodeBoxSize({ width: 500 }, { width: 400, height: 260 })).toEqual({
      width: 516,
      height: 276,
    });
  });

  it('gives back the box it was handed, so a resize settles', () => {
    // The write-back stores `box - 2 * margin` and this adds it again. If the
    // two disagreed, every resize would grow the node by the difference and
    // keep growing it.
    const box = nodeBoxSize({ width: 500, height: 300 }, undefined);
    const stored = { width: box.width - 16, height: box.height - 16 };

    expect(nodeBoxSize(stored, undefined)).toEqual(box);
  });
});

/**
 * The layer stack, from the surface's side.
 *
 * The reducer owns what the stack *is*; this is about the two things only the
 * surface can do — ask for a first layer when a board has none, and put a new
 * stroke on the one its author was working on.
 */
describe('ExcalidrawLayerComponent — layers', () => {
  // Its own reset: the suite above has one, and a `beforeEach` does not reach
  // a sibling describe. Without this the first test's dispatch is still on
  // the mock when the second one asserts nothing was dispatched.
  beforeEach(() => {
    mockCapturedOnChange = null;
    mockScene = [];
    mockNodeViews = [];
    mockGraphNodes = [];
    mockEdges = [];
    mockLayers = [];
    mockRemote.clear();
    mockDispatch.mockClear();
    mockUpdateLayerTrees.mockClear();
  });

  it('asks for a first layer on a board that has never had one', async () => {
    // Created on first sight rather than by a migration: a board that
    // predates layers has elements with no layer at all, and those belong at
    // the bottom whether or not the bottom has a name yet.
    mockLayers = [];

    await mount();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'excalidraw:new-layer',
        drawingId: 'view-1',
        title: 'Layer 1',
      })
    );
  });

  it('asks for none when the board already has one', async () => {
    mockLayers = [
      { id: 'layer-1', drawingId: 'view-1', title: 'Layer 1', order: 0 },
    ];

    await mount();

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'excalidraw:new-layer' })
    );
  });

  it('ignores another drawing’s layers when deciding', async () => {
    // The stack is per drawing. Counting someone else's would leave this
    // board with no layer and nowhere for a stroke to go.
    mockLayers = [
      { id: 'other', drawingId: 'view-2', title: 'Layer 1', order: 0 },
    ];

    await mount();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'excalidraw:new-layer' })
    );
  });

  it('publishes one panel entry per layer, front of the stack first', async () => {
    // Front first because a layers panel is read top-down as the eye reads
    // the board front-to-back — the convention every drawing tool shares.
    mockLayers = [
      { id: 'back', drawingId: 'view-1', title: 'Back', order: 0 },
      { id: 'front', drawingId: 'view-1', title: 'Front', order: 1 },
    ];

    await mount();
    await act(async () => {
      mockCapturedOnChange?.([element('a', 1)]);
    });

    const [, published] =
      mockUpdateLayerTrees.mock.calls[
        mockUpdateLayerTrees.mock.calls.length - 1
      ];
    expect(published.map((l: { title: string }) => l.title)).toEqual([
      'Front',
      'Back',
    ]);
  });
});

/**
 * The one destructive path this layer has, and the way it went wrong.
 *
 * `updateScene` replaces the element list, so a node missing from a
 * projection comes back tombstoned on the next change. Read as an erasure,
 * that deleted a real node from a real board — and the service behind it went
 * on running with nothing left pointing at it. The case where somebody
 * actually reached for the eraser is covered above; this is the other one.
 */
describe('ExcalidrawLayerComponent — a tombstone the projection made itself', () => {
  beforeEach(() => {
    mockCapturedOnChange = null;
    mockScene = [];
    mockNodeViews = [];
    mockGraphNodes = [];
    mockEdges = [];
    mockLayers = [];
    mockRemote.clear();
    mockDispatch.mockClear();
  });

  it('deletes nothing for a node the projection never drew', async () => {
    jest.useFakeTimers();
    // No views, so the projection draws no node — and any tombstone carrying
    // a node id is therefore the projection's own doing.
    mockNodeViews = [];
    try {
      await mount();
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        mockCapturedOnChange?.([
          {
            id: 'holistix-node-ghost',
            version: 9,
            type: 'embeddable',
            x: 0,
            y: 0,
            isDeleted: true,
            customData: {
              holistixNodeId: 'ghost',
              holistixViewId: 'view-1',
            },
          } as never,
        ]);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });

      expect(
        mockDispatch.mock.calls
          .map(([e]) => e)
          .filter((e) => e?.type === 'core:delete-node')
      ).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
