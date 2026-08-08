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
import {
  useDispatcher,
  FrontendDispatcher,
} from '@holistix-forge/reducers/frontend';
import { TWhiteboardEvent } from '@holistix-forge/whiteboard';
import {
  useLayerContext,
  TLayerTreeItem,
} from '@holistix-forge/whiteboard/frontend';

import { TExcalidrawSharedData } from './excalidraw-shared-model';
import { TExcalidrawEvent } from './excalidraw-events';
import { readDrawingElements, versionsById } from './excalidraw-scene';

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

/**
 * Keep the ExcalidrawNode's box on the drawing it stands for.
 *
 * Still driven from here, which keeps the node following rather than owning
 * its own geometry. That inversion is phase 2's problem; what this no longer
 * does is serialize an SVG of the whole scene into Yjs on every keystroke.
 */
const fitNodeToDrawing = async (
  dispatcher: FrontendDispatcher<TLayerEvent>,
  viewId: string,
  nodeId: string,
  elements: readonly OrderedExcalidrawElement[]
) => {
  if (!elements.length) return;

  const { getCommonBounds } = (await import(
    '@excalidraw/excalidraw'
  )) as unknown as {
    getCommonBounds: (
      elements: readonly OrderedExcalidrawElement[]
    ) => [number, number, number, number];
  };

  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const padding = 25; // look for css : .selection-awareness-box

  dispatcher.dispatch({
    type: 'whiteboard:move-node',
    viewId,
    nid: nodeId,
    position: { x: minX - padding, y: minY - padding },
  });
  dispatcher.dispatch({
    type: 'whiteboard:resize-node',
    viewId,
    nid: nodeId,
    size: {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    },
  });
};

//

export type TExcalidrawLayerPayload = { nodeId: string; viewId: string };

// nodeId will be determined from payload

export const ExcalidrawLayerComponent: FC<{
  viewId: string;
  active: boolean;
  viewport: LayerViewportAdapter;
  payload?: TExcalidrawLayerPayload;
}> = ({ active, viewport, payload }) => {
  const { nodeId = '', viewId = '' } = payload || {};

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

  // Pull remote changes into the scene.
  //
  // Excalidraw's own reconciler decides element by element, on
  // `version`/`versionNonce`. The previous code compared a `fromUser` field on
  // the whole drawing and, when it differed, replaced the entire scene — so
  // two people drawing at once overwrote each other wholesale.
  useEffect(() => {
    if (!nodeId) return;
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
        nodeId
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
  }, [nodeId, sharedData]);

  //

  /**
   * Recomputes the delta from the current scene on every run rather than
   * carrying one in, so a debounced-away change is never a lost change.
   */
  const flush = useMemo(
    () =>
      debounce(
        async () => {
          if (!nodeId) return;
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
              drawingId: nodeId,
              elements: upserts as unknown as TJsonObject[],
            });
          }
          if (deletedIds.length) {
            await dispatcher.dispatch({
              type: 'excalidraw:delete-elements',
              drawingId: nodeId,
              elementIds: deletedIds,
            });
          }

          await fitNodeToDrawing(dispatcher, viewId, nodeId, elements);
        },
        250,
        { maxWait: 250 }
      ),
    [dispatcher, nodeId, viewId]
  );

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      pendingElements.current = elements;

      // Update tree data for the layer panel
      if (updateLayerTree && nodeId) {
        const treeItems: TLayerTreeItem[] = elements
          .filter((e) => !e.isDeleted)
          .map((element, index) => ({
            // Keyed on the element's own id, not its position in the array:
            // indices shift on every delete, so the tree used to re-label and
            // re-target its rows behind the user's back.
            id: `${nodeId}-element-${element.id}`,
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
              id: `${nodeId}-element-${element.id}`,
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
    [flush, nodeId, updateLayerTree]
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
      if (updateLayerTree && nodeId) {
        updateLayerTree('excalidraw', [], 'Excalidraw');
      }
    };
  }, [flush, updateLayerTree, nodeId]);

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
        }}
        initialData={{
          appState: { ...appState, ...toExcalidrawViewport(initialVp) },
          elements: structuredClone(
            readDrawingElements(sharedData, nodeId)
          ) as unknown as OrderedExcalidrawElement[],
        }}
        onChange={handleChange}
        onScrollChange={handleScrollChange}
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
