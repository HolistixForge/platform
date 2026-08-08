import { useMemo, FC, useEffect, useRef, useState, useCallback } from 'react';
import { debounce } from 'lodash';

import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState, Collaborator, SocketId } from '@excalidraw/excalidraw/types';

import { TJsonObject } from '@holistix-forge/simple-types';
import {
  LayerViewportAdapter,
  TLayerProvider,
} from '@holistix-forge/whiteboard/frontend';
import {
  useAwarenessUserList,
  useSharedDataDirect,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TWhiteboardEvent } from '@holistix-forge/whiteboard';
import {
  useLayerContext,
  TLayerTreeItem,
} from '@holistix-forge/whiteboard/frontend';

import { TExcalidrawSharedData } from './excalidraw-shared-model';
import { TExcalidrawEvent } from './excalidraw-events';
import {
  readDrawingElements,
  sceneSignature,
  versionsById,
} from './excalidraw-scene';
import { SpikeEmbeddable } from './spike-embeddable';

//

/** The layer writes its own elements and moves the node that stands for them. */
type TLayerEvent = TWhiteboardEvent | TExcalidrawEvent;

type ExcalidrawAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene: (scene: any) => void;
  getAppState: () => AppState;
  getSceneElementsIncludingDeleted?: () => readonly OrderedExcalidrawElement[];
};

//

let cssLoaded = false;

const ensureCss = async () => {
  if (cssLoaded) return;
  await import('@excalidraw/excalidraw/index.css');
  cssLoaded = true;
};

//

const appState = {
  viewModeEnabled: false,
  zenModeEnabled: false,
  gridSize: undefined as number | undefined,
  theme: 'light' as const,
  viewBackgroundColor: 'transparent',
};

//

// There used to be a `fitNodeToDrawing` here, keeping an ExcalidrawNode's box
// on the drawing it stood for. The node is gone: the layer is the whiteboard,
// so a drawing no longer needs anything in the graph to represent it.

/**
 * TAC-211 probe — throwaway, removed with spike-embeddable.tsx.
 *
 * `validateEmbeddable` is what Excalidraw consults to decide whether an
 * element may be embedded. It is documented in terms of links, and our
 * elements have none; a permissive predicate is how the spike finds out
 * whether the absence of a URL is itself the gate.
 */
const alwaysValid = () => true;

const renderSpikeEmbeddable = (element: {
  id: string;
  customData?: Record<string, unknown>;
}) => <SpikeEmbeddable id={element.id} data={element.customData ?? {}} />;

/**
 * Drop an embeddable into the scene, with a rectangle beside it: whether a
 * native Excalidraw arrow binds to an embeddable the way it binds to a shape
 * is half of what the phase-2 architecture is betting on.
 */
const insertSpikeEmbeddable = async (api: ExcalidrawAPI | null) => {
  if (!api) return;

  const { convertToExcalidrawElements } = (await import(
    '@excalidraw/excalidraw'
  )) as unknown as {
    convertToExcalidrawElements: (
      skeletons: unknown[]
    ) => OrderedExcalidrawElement[];
  };

  const existing = api.getSceneElementsIncludingDeleted?.() ?? [];
  const n = existing.filter((e) => e.type === 'embeddable').length;

  // Two variants side by side, because the first run showed the element being
  // created without `renderEmbeddable` ever being called. The only difference
  // between them is the link, which makes one run answer whether the absence
  // of a URL is the gate.
  const added = convertToExcalidrawElements([
    {
      type: 'embeddable',
      x: 150 + n * 720,
      y: 150,
      width: 300,
      height: 220,
      link: null,
      customData: { label: `no-link #${n + 1}` },
    },
    {
      type: 'embeddable',
      x: 500 + n * 720,
      y: 150,
      width: 300,
      height: 220,
      link: `https://holistix.invalid/node/${n + 1}`,
      customData: { label: `with-link #${n + 1}` },
    },
    {
      type: 'rectangle',
      x: 150 + n * 720,
      y: 460,
      width: 160,
      height: 70,
      label: { text: `target ${n + 1}` },
    },
  ]);

  api.updateScene({ elements: [...existing, ...added] });
};

//

export type TExcalidrawLayerPayload = { nodeId?: string; viewId?: string };

export const ExcalidrawLayerComponent: FC<{
  viewId: string;
  active: boolean;
  viewport: LayerViewportAdapter;
  payload?: TExcalidrawLayerPayload;
}> = ({ viewId: viewIdProp, active, viewport, payload }) => {
  const viewId = payload?.viewId || viewIdProp;

  // The drawing belongs to the view. It used to be keyed on the id of the
  // ExcalidrawNode that stood for it, which only worked because opening the
  // layer meant clicking Edit on that node. The layer is the whiteboard now:
  // there is no node to key it on, and one view is one drawing.
  const drawingId = viewId;

  const dispatcher = useDispatcher<TLayerEvent>();
  const { updateLayerTree } = useLayerContext();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Excalidraw, setExcalidraw] = useState<FC<any> | null>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  const toExcalidrawViewport = useCallback(
    (vp: { absoluteX: number; absoluteY: number; zoom: number }) => ({
      scrollX: vp.absoluteX,
      scrollY: vp.absoluteY,
      zoom: { value: vp.zoom },
    }),
    []
  );

  //

  useEffect(() => {
    return viewport.registerViewportChangeCallback((vp) => {
      if (apiRef.current) {
        const state = apiRef.current.getAppState();
        apiRef.current.updateScene({
          appState: { ...state, ...toExcalidrawViewport(vp) },
        });
      }
    });
  }, [viewport, toExcalidrawViewport]);

  //

  useEffect(() => {
    if (!active || Excalidraw) return;
    (async () => {
      await ensureCss();
      const mod = await import('@excalidraw/excalidraw');
      setExcalidraw(() => (mod as { Excalidraw: FC }).Excalidraw);
    })();
  }, [active, Excalidraw]);

  //

  const handleScrollChange = useCallback(
    (scrollX: number, scrollY: number, zoom: { value: number }) => {
      viewport.onViewportChange({
        absoluteX: scrollX,
        absoluteY: scrollY,
        zoom: zoom.value,
      });
    },
    [viewport]
  );

  // collaborative

  const users = useAwarenessUserList();
  // Build collaborators map from user list (using username as key)
  const collaborators = useMemo(() => {
    const map = new Map<SocketId, Collaborator>();
    users.forEach((u) => {
      map.set(u.username as SocketId, {
        username: u.username,
        color: { background: u.color, stroke: u.color },
      });
    });
    return map;
  }, [users]);

  //

  const sharedData = useSharedDataDirect<TExcalidrawSharedData>();

  /** What we last pushed, so a change is diffed rather than resent whole. */
  const sentVersions = useRef<Map<string, number>>(new Map());
  /** Latest scene, read by the flush instead of captured by it. */
  const pendingElements = useRef<readonly OrderedExcalidrawElement[]>([]);
  /** The scene the last onChange acted on — see the note in handleChange. */
  const lastSignature = useRef<string | null>(null);

  // Pull remote changes into the scene.
  //
  // Excalidraw's own reconciler decides element by element, on
  // `version`/`versionNonce`. The previous code compared a `fromUser` field on
  // the whole drawing and, when it differed, replaced the entire scene — so
  // two people drawing at once overwrote each other wholesale.
  useEffect(() => {
    if (!drawingId) return;
    const map = sharedData['excalidraw:elements'];

    const pull = async () => {
      const api = apiRef.current;
      if (!api) return;

      const { reconcileElements, getSceneVersion } = (await import(
        '@excalidraw/excalidraw'
      )) as unknown as {
        reconcileElements: (
          local: readonly OrderedExcalidrawElement[],
          remote: readonly OrderedExcalidrawElement[],
          appState: AppState
        ) => OrderedExcalidrawElement[];
        getSceneVersion: (e: readonly OrderedExcalidrawElement[]) => number;
      };

      const remote = readDrawingElements(
        sharedData,
        drawingId
      ) as unknown as readonly OrderedExcalidrawElement[];
      const local = api.getSceneElementsIncludingDeleted?.() ?? [];
      const reconciled = reconcileElements(local, remote, api.getAppState());

      // Our own write comes back through this same observer. Applying it again
      // would feed the loop, so only touch the scene when it actually differs.
      if (getSceneVersion(reconciled) === getSceneVersion(local)) return;

      sentVersions.current = versionsById(
        reconciled as unknown as TJsonObject[]
      );
      api.updateScene({ elements: reconciled });
    };

    map.observe(pull);
    pull();
    // The previous version never unobserved: every mount left a listener
    // behind, still writing into the scene of a component that was gone.
    return () => map.unobserve(pull);
  }, [drawingId, sharedData]);

  //

  /**
   * Recomputes the delta from the current scene on every run rather than
   * carrying one in, so a debounced-away change is never a lost change.
   */
  const flush = useMemo(
    () =>
      debounce(
        async () => {
          if (!drawingId) return;
          const elements = pendingElements.current;
          const current = versionsById(elements as unknown as TJsonObject[]);

          const upserts = elements.filter(
            (e) => sentVersions.current.get(e.id) !== e.version
          );
          const deletedIds = [...sentVersions.current.keys()].filter(
            (id) => !current.has(id)
          );

          sentVersions.current = current;

          if (upserts.length) {
            await dispatcher.dispatch({
              type: 'excalidraw:upsert-elements',
              drawingId: drawingId,
              elements: upserts as unknown as TJsonObject[],
            });
          }
          if (deletedIds.length) {
            await dispatcher.dispatch({
              type: 'excalidraw:delete-elements',
              drawingId: drawingId,
              elementIds: deletedIds,
            });
          }
        },
        250,
        { maxWait: 250 }
      ),
    [dispatcher, drawingId]
  );

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      pendingElements.current = elements;

      // Everything below reaches out of this component — the layer tree lives
      // in the whiteboard's state, and the flush dispatches. Excalidraw calls
      // onChange for `appState` too, including the viewport writes this layer
      // makes itself, so without this the handler answers its own echo:
      // onChange → updateLayerTree → whiteboard re-render → updateScene →
      // onChange. That loop is what took the whole editor down with React's
      // "maximum update depth", and it did so from whichever component
      // happened to hold a Radix popper — never from anything named
      // Excalidraw, which is why it read as a third-party problem.
      const signature = sceneSignature(elements as unknown as TJsonObject[]);
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;

      // Update tree data for the layer panel
      if (updateLayerTree && drawingId) {
        const treeItems: TLayerTreeItem[] = elements
          .filter((e) => !e.isDeleted)
          .map((element, index) => ({
            // Keyed on the element's own id, not its position in the array:
            // indices shift on every delete, so the tree used to re-label and
            // re-target its rows behind the user's back.
            id: `${drawingId}-element-${element.id}`,
            type: 'node',
            title:
              element.type === 'text'
                ? element.text || `Text ${index + 1}`
                : `${
                    element.type.charAt(0).toUpperCase() + element.type.slice(1)
                  } ${index + 1}`,
            level: 1,
            visible: true,
            expanded: false,
            locked: false,
            nodeData: {
              id: `${drawingId}-element-${element.id}`,
              type: 'excalidraw-element',
              position: { x: element.x, y: element.y },
              status: {
                mode: 'EXPANDED' as const,
                forceOpened: false,
                forceClosed: false,
                isFiltered: false,
                rank: 0,
                maxRank: 1,
              },
            },
            layerId: 'excalidraw',
          }));

        updateLayerTree('excalidraw', treeItems, 'Excalidraw');
      }

      flush();
    },
    [flush, drawingId, updateLayerTree]
  );

  // mode switch, collaborators update, content update

  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.updateScene({
        appState: {
          ...apiRef.current.getAppState(),
          ...appState,
          collaborators,
        },
      });
    }
  }, [collaborators]);

  // Cancel debounce on unmount, clear layer tree
  useEffect(() => {
    return () => {
      flush.cancel();
      if (updateLayerTree && drawingId) {
        updateLayerTree('excalidraw', [], 'Excalidraw');
      }
    };
  }, [flush, updateLayerTree, drawingId]);

  //
  //
  //
  //

  if (!active) return null;
  if (!Excalidraw) return null;

  const initialVp = viewport.getViewport
    ? viewport.getViewport()
    : { absoluteX: 0, absoluteY: 0, zoom: 1 };

  return (
    <div
      className="excalidraw-layer"
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* TAC-211 probe control — throwaway */}
      <button
        data-testid="spike-insert-embeddable"
        onClick={() => insertSpikeEmbeddable(apiRef.current)}
        style={{
          position: 'absolute',
          top: 8,
          right: 150,
          zIndex: 50,
          background: '#672aa4',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        + spike embeddable
      </button>

      <Excalidraw
        excalidrawAPI={(api: ExcalidrawAPI) => {
          apiRef.current = api;
          // TAC-211 probe handle — throwaway, lets the spike inspect and
          // mutate the live scene from the console instead of rebuilding.
          (window as unknown as { __exApi: ExcalidrawAPI }).__exApi = api;
        }}
        initialData={{
          appState: { ...appState, ...toExcalidrawViewport(initialVp) },
          elements: structuredClone(
            readDrawingElements(sharedData, drawingId)
          ) as unknown as OrderedExcalidrawElement[],
        }}
        onChange={handleChange}
        onScrollChange={handleScrollChange}
        // TAC-211 probe. Both are module constants, never inline arrows: a
        // fresh identity per render sends Excalidraw into a re-render loop
        // through its own ref callbacks, React error #185, before an
        // embeddable even exists.
        validateEmbeddable={alwaysValid}
        renderEmbeddable={renderSpikeEmbeddable}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
            changeViewBackgroundColor: false,
            clearCanvas: false,
          },
          tools: {
            image: false,
          },
        }}
      />
    </div>
  );
};

export const layer: TLayerProvider = {
  id: 'excalidraw',
  title: 'Excalidraw',
  zIndexHint: 10,
  Component: ExcalidrawLayerComponent,
};
