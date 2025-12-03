import { useMemo, FC, useEffect, useRef, useState, useCallback } from 'react';
import { debounce } from 'lodash';

import { useCurrentUser } from '@holistix/frontend-data';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState, Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import { BinaryFiles } from '@excalidraw/excalidraw/types';

import { TJsonObject } from '@holistix/simple-types';
import { LayerViewportAdapter, TLayerProvider } from '@holistix/space/frontend';
import {
  useAwarenessUserList,
  useSharedDataDirect,
} from '@holistix/collab/frontend';
import { useDispatcher, FrontendDispatcher } from '@holistix/reducers/frontend';
import { TSpaceEvent } from '@holistix/space';
import { useLayerContext, TLayerTreeItem } from '@holistix/space/frontend';

import { TExcalidrawSharedData } from './excalidraw-shared-model';

//

// Excalidraw export helpers will be dynamically imported when needed
type ExportToSvgArgs = {
  elements: readonly OrderedExcalidrawElement[];
  appState: Partial<AppState> & {
    exportBackground?: boolean;
    exportWithDarkMode?: boolean;
  };
  files: BinaryFiles;
};

//

type ExcalidrawAPI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateScene: (scene: any) => void;
  getAppState: () => AppState;
};

//

let cssLoaded = false;

const ensureCss = async () => {
  if (cssLoaded) return;
  await import('@excalidraw/excalidraw/index.css');
  cssLoaded = true;
};

//

// Simple fast hash function for objects/arrays
function simpleHash(obj: TJsonObject[]): string {
  const str = JSON.stringify(obj);
  let hash = 0,
    i,
    chr;
  if (str.length === 0) return hash.toString();
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

//

const appState = {
  viewModeEnabled: false,
  zenModeEnabled: false,
  gridSize: undefined as number | undefined,
  theme: 'light' as const,
  viewBackgroundColor: 'transparent',
};

//

// Debounced function for setting drawing data
const debouncedHandleChange = debounce(
  async (
    sharedData: TExcalidrawSharedData,
    viewId: string,
    dispatcher: FrontendDispatcher<TSpaceEvent>,
    nodeId: string,
    elements: readonly OrderedExcalidrawElement[],
    files: BinaryFiles,
    api: ExcalidrawAPI,
    userid: string
  ) => {
    // Generate SVG using Excalidraw export helper (dynamic import)
    let svgString = '';

    try {
      const { exportToSvg, getCommonBounds } = (await import(
        '@excalidraw/excalidraw'
      )) as unknown as {
        exportToSvg: (args: ExportToSvgArgs) => Promise<SVGSVGElement>;
        getCommonBounds: (
          elements: readonly OrderedExcalidrawElement[]
        ) => [number, number, number, number];
      };

      if (elements.length > 0) {
        // Get the bounds of the actual drawing content
        const [minX, minY, maxX, maxY] = getCommonBounds(
          elements as readonly OrderedExcalidrawElement[]
        );

        const currentAppState = api.getAppState() || ({} as AppState);

        const svgEl = await exportToSvg({
          elements: elements as readonly OrderedExcalidrawElement[],
          appState: {
            ...currentAppState,
            exportBackground: false,
            exportWithDarkMode: false,
            // Set the viewport to focus on the drawing bounds
            scrollX: minX,
            scrollY: minY,
          },
          files,
        });

        svgString = new XMLSerializer().serializeToString(svgEl);

        const selectionAwarenessBoxPadding = 25; // look for css : .selection-awareness-box

        // move the excalidraw node to the xmin, ymin
        dispatcher.dispatch({
          type: 'space:move-node',
          viewId: viewId,
          nid: nodeId,
          position: {
            x: minX - selectionAwarenessBoxPadding,
            y: minY - selectionAwarenessBoxPadding,
          },
        });
        dispatcher.dispatch({
          type: 'space:resize-node',
          viewId: viewId,
          nid: nodeId,
          size: {
            width: maxX - minX + selectionAwarenessBoxPadding * 2,
            height: maxY - minY + selectionAwarenessBoxPadding * 2,
          },
        });
      }

      sharedData['excalidraw:drawing'].set(nodeId, {
        elements: elements as unknown as TJsonObject[],
        fromUser: userid,
        svg: svgString,
      });
    } catch (e) {
      console.error('exportToSvg failed', e);
      // best-effort; keep svg empty on failure
    }
  },
  250,
  { maxWait: 250 }
);
//

export type TExcalidrawLayerPayload = { nodeId: string; viewId: string };

// nodeId will be determined from payload

export const ExcalidrawLayerComponent: FC<{
  viewId: string;
  active: boolean;
  viewport: LayerViewportAdapter;
  payload?: TExcalidrawLayerPayload;
}> = ({ active, viewport, payload }) => {
  const { data, status } = useCurrentUser();
  const userid =
    status === 'success' && data.user.user_id ? data.user.user_id : '';

  const { nodeId = '', viewId = '' } = payload || {};

  const dispatcher = useDispatcher<TSpaceEvent>();
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

  useEffect(() => {
    // On mount, ensure drawing entry exists or initialize it
    if (!nodeId) return;
    const d = sharedData['excalidraw:drawing'].get(nodeId);
    if (!d) {
      const elements: TJsonObject[] = [];
      sharedData['excalidraw:drawing'].set(nodeId, {
        elements,
        fromUser: userid,
        svg: '',
      });
    }
    // Observe remote changes
    sharedData['excalidraw:drawing'].observe(() => {
      const d = sharedData['excalidraw:drawing'].get(nodeId);
      if (d?.fromUser !== userid) {
        // update the drawing if it is from another user
        previousHash.current = simpleHash(d?.elements || []);
        apiRef.current?.updateScene({
          elements: structuredClone(d?.elements) || [],
        });
      }
    });
  }, [nodeId, sharedData, userid]);

  //

  const previousHash = useRef<string | null>(null);

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      _appState: AppState,
      files: BinaryFiles
    ) => {
      const hash = simpleHash(elements as unknown as TJsonObject[]);
      if (hash !== previousHash.current) {
        previousHash.current = hash;

        // Update tree data for the layer panel
        if (updateLayerTree && nodeId) {
          // console.log('elements', elements);
          const treeItems: TLayerTreeItem[] = elements
            .filter((e) => !e.isDeleted)
            .map((element, index) => ({
              id: `${nodeId}-element-${index}`,
              type: 'node',
              title:
                element.type === 'text'
                  ? element.text || `Text ${index + 1}`
                  : `${
                      element.type.charAt(0).toUpperCase() +
                      element.type.slice(1)
                    } ${index + 1}`,
              level: 1,
              visible: true,
              expanded: false,
              locked: false,
              nodeData: {
                id: `${nodeId}-element-${index}`,
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

        debouncedHandleChange(
          sharedData,
          viewId,
          dispatcher,
          nodeId,
          elements,
          files,
          apiRef.current as ExcalidrawAPI,
          userid
        );
      }
    },

    [dispatcher, nodeId, sharedData, viewId, userid, updateLayerTree]
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
      debouncedHandleChange.cancel();
      previousHash.current = null;
      if (updateLayerTree && nodeId) {
        updateLayerTree('excalidraw', [], 'Excalidraw');
      }
    };
  }, [updateLayerTree, nodeId]);

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
          elements:
            (structuredClone(
              sharedData['excalidraw:drawing'].get(nodeId)?.elements
            ) as unknown as OrderedExcalidrawElement[]) || [],
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
