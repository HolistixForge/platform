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
/** The scene the fake Excalidraw holds. */
let mockScene: { id: string; version: number }[] = [];

jest.mock('@excalidraw/excalidraw/index.css', () => ({}), { virtual: true });

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
        updateScene: (u: { elements?: unknown[] }) => {
          mockUpdateSceneCalls++;
          if (u.elements) mockScene = u.elements as typeof mockScene;
        },
        getAppState: () => ({}),
        getSceneElementsIncludingDeleted: () => mockScene,
      });
      return null;
    },
    convertToExcalidrawElements: (skeletons: unknown[]) =>
      skeletons.map((sk, i) => ({
        ...(sk as object),
        id: `gen-${i}`,
        version: 1,
      })),
    restoreElements: (els: unknown) => els,
    reconcileElements: (local: unknown[]) => local,
    getSceneVersion: () => 0,
    getCommonBounds: () => [0, 0, 0, 0],
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
const mockSharedData = {
  'excalidraw:elements': {
    forEach: () => undefined,
    observe: () => undefined,
    unobserve: () => undefined,
  },
};
const mockUsers: unknown[] = [];

/** Node views the layer should project. Set per test. */
let mockNodeViews: { id: string; position: { x: number; y: number } }[] = [];
const mockGraphView = () =>
  mockNodeViews.length
    ? { nodeViews: mockNodeViews.map((nv) => ({ ...nv, status: {} })) }
    : undefined;

/** Every updateScene the layer performs, so a loop is visible as a count. */
let mockUpdateSceneCalls = 0;

jest.mock('@holistix-forge/whiteboard/frontend', () => ({
  useLayerContext: () => mockLayerContext,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwarenessUserList: () => mockUsers,
  useSharedDataDirect: () => mockSharedData,
  // The graph view the layer projects into the scene. A *fresh object every
  // call*, which is what the real hook does — the layer must not treat that
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
    mockScene = [];
    mockNodeViews = [];
    mockUpdateSceneCalls = 0;
    mockUpdateLayerTree.mockClear();
    mockDispatch.mockClear();
  });

  it('projects the graph\u2019s nodes once, not on every shared-data change', async () => {
    // The freeze this reproduces: the projection effect depended on the array
    // the graph-view hook returns, that hook returns a fresh array every call,
    // and the projection itself causes a call. The tab locked up.
    mockNodeViews = [{ id: 'node-a', position: { x: 0, y: 0 } }];

    await mount();
    await act(async () => {
      await Promise.resolve();
    });

    // A handful of scene writes is fine — the drawing and the projection. A
    // runaway loop is not.
    expect(mockUpdateSceneCalls).toBeLessThan(5);
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
