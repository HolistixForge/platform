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
  useLocalSharedData,
  useSharedDataDirect,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  TNodeView,
  TWhiteboardEvent,
  TWhiteboardSharedData,
} from '@holistix-forge/whiteboard';
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
import { EmbeddedNode } from './embedded-node';

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
 * The link every projected node carries.
 *
 * Excalidraw never calls `renderEmbeddable` for an embeddable whose `link` is
 * null, and `validateEmbeddable` does not rescue one — measured on the
 * installed version. The link also has to be there when the element is
 * created: setting it afterwards does not re-validate, and the element stays
 * blank. So a node gets a sentinel URL that resolves to nothing and is never
 * followed, and what actually identifies it travels in `customData`.
 */
const NODE_LINK_PREFIX = 'https://node.holistix.invalid/';

const nodeLink = (nodeId: string) => `${NODE_LINK_PREFIX}${nodeId}`;

/**
 * Only that host, and nothing else, is embeddable.
 *
 * The scheme is not decoration: a custom one (`holistix:node/…`) produced an
 * element Excalidraw accepted into the scene and then never rendered — it
 * resolves the link before consulting this predicate. `.invalid` is reserved
 * by RFC 2606 and resolves nowhere, so the URL is inert even if something ever
 * tried to follow it.
 */
const validateEmbeddable = (link: string) => link.startsWith(NODE_LINK_PREFIX);

/** The node a projected embeddable stands for, or nothing. */
export const embeddedNodeId = (element: {
  customData?: Record<string, unknown>;
}): string | undefined => {
  const id = element.customData?.['holistixNodeId'];
  return typeof id === 'string' ? id : undefined;
};

/**
 * Excalidraw reads this prop once, as a stable identity — an inline arrow here
 * is the React #185 loop. So it cannot close over the view, and the view
 * travels in `customData` beside the node id.
 */
const renderNode = (element: {
  customData?: Record<string, unknown>;
}): JSX.Element | null => {
  const nodeId = embeddedNodeId(element);
  const viewId = element.customData?.['holistixViewId'];
  if (!nodeId || typeof viewId !== 'string') return null;
  return <EmbeddedNode nodeId={nodeId} viewId={viewId} />;
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
  /**
   * Set when Excalidraw hands its API over, which it does after this
   * component's own effects have already run — so the projection has to be
   * told rather than read the ref.
   */
  const [apiReady, setApiReady] = useState(false);

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

  // The graph's nodes, projected into the scene as embeddables.
  //
  // They are *not* part of the drawing: the graph already owns them, and
  // writing them into `excalidraw:elements` would give every node two homes
  // that drift apart. They are injected locally and excluded from the flush.
  const graphView = useLocalSharedData<TWhiteboardSharedData>(
    ['whiteboard:graphViews'],
    (sd) => sd['whiteboard:graphViews']?.get(viewId)
  );

  const nodeViews: TNodeView[] = useMemo(
    () => graphView?.nodeViews ?? [],
    [graphView?.nodeViews]
  );

  /** Read by the projection effect, so its identity is not a dependency. */
  const latestNodeViews = useRef<TNodeView[]>(nodeViews);
  latestNodeViews.current = nodeViews;

  /** Rebuilt whenever a node moves, is added or is removed. */
  const nodeSignature = useMemo(
    () =>
      nodeViews
        .map(
          (nv) =>
            `${nv.id}@${Math.round(nv.position.x)},${Math.round(
              nv.position.y
            )}:${nv.size?.width ?? 0}x${nv.size?.height ?? 0}`
        )
        .join('|'),
    [nodeViews]
  );

  /**
   * Injected after mount, deliberately.
   *
   * Excalidraw validates an embeddable in `updateEmbeddables()`, and that runs
   * from `componentDidUpdate` only — never from `componentDidMount`
   * (App.tsx:2704 in 0.18.0). An element present in `initialData` is therefore
   * never validated, `embedsValidationStatus` has no entry for it, and
   * `renderEmbeddables()` filters it out:
   *
   *     .filter(a => isIframeLikeElement(a) &&
   *                  this.embedsValidationStatus.get(a.id) === true || ...)
   *
   * So the nodes go in through `updateScene`, whose update cycle is what gets
   * them validated.
   */
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    // Off unless asked for. Projecting the graph into the drawing surface is
    // the experiment, and it is the half that can take a tab down — keeping it
    // behind a switch means the board still loads while it is being worked on,
    // and means it can be turned on with the page already open:
    //   localStorage.setItem('holistix:excalidraw-nodes', '1')
    if (localStorage.getItem('holistix:excalidraw-nodes') !== '1') return;

    let cancelled = false;

    (async () => {
      const { convertToExcalidrawElements, restoreElements } = (await import(
        '@excalidraw/excalidraw'
      )) as unknown as {
        convertToExcalidrawElements: (
          skeletons: unknown[]
        ) => OrderedExcalidrawElement[];
        restoreElements: (
          elements: unknown,
          localElements: unknown
        ) => OrderedExcalidrawElement[];
      };
      if (cancelled) return;

      const scene = api.getSceneElementsIncludingDeleted?.() ?? [];
      const drawing = scene.filter((e) => !embeddedNodeId(e));

      const views = latestNodeViews.current;
      const projected = convertToExcalidrawElements(
        views.map((nv) => ({
          type: 'embeddable',
          x: nv.position.x,
          y: nv.position.y,
          width: nv.size?.width ?? 320,
          height: nv.size?.height ?? 220,
          link: nodeLink(nv.id),
          customData: { holistixNodeId: nv.id, holistixViewId: viewId },
        }))
      );

      // Normalised before it goes in. `convertToExcalidrawElements` leaves an
      // embeddable with only the fields the skeleton named — no `angle`, no
      // `opacity`, no `seed` — and Excalidraw's viewport test needs them: the
      // element validated fine and was then judged invisible, so it never
      // rendered. Measured: 12 fields against the 27 a real element carries.
      const restored = restoreElements(projected, null);

      api.updateScene({ elements: [...drawing, ...restored] });
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the signature alone. `nodeViews` is a fresh array on every
    // shared-data change and this effect causes one, so depending on it is a
    // loop — it froze the tab. The signature is what says a node moved.
  }, [nodeSignature, viewId, apiReady]);

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

      // Only what actually came from the shared map counts as sent.
      //
      // `reconcileElements` returns the union of local and remote, so recording
      // the whole reconciliation marked the strokes someone had just drawn —
      // still sitting in the 250 ms debounce, never dispatched — as already
      // saved. The next flush then found no delta and dropped them: they
      // vanished for everyone else and did not survive a reload, and only came
      // back if the element happened to be edited again.
      const merged = new Map(sentVersions.current);
      for (const [id, version] of versionsById(
        remote as unknown as TJsonObject[]
      )) {
        merged.set(id, version);
      }
      sentVersions.current = merged;

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

          // Projected nodes are the graph's, not the drawing's. Letting them
          // through would write every node into `excalidraw:elements` as well,
          // so each would exist twice and the two copies would drift.
          const elements = pendingElements.current.filter(
            (e) => !embeddedNodeId(e)
          );
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
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawAPI) => {
          apiRef.current = api;
          setApiReady(true);
          // TEMP debug handle — removed once the integration renders.
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
        // Module constants, never inline arrows: a fresh identity per render
        // sends Excalidraw into a re-render loop through its own ref
        // callbacks — React error #185 — before an embeddable even exists.
        validateEmbeddable={validateEmbeddable}
        renderEmbeddable={renderNode}
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
