import { useMemo, FC, useEffect, useRef, useState, useCallback } from 'react';
import { debounce } from 'lodash';

import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState, Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import { BinaryFiles } from '@excalidraw/excalidraw/types';

import { TJsonObject } from '@monorepo/simple-types';
import {
  LayerViewportAdapter,
  TLayerProvider,
} from '@monorepo/module/frontend';
import { useAwarenessUserList } from '@monorepo/collab-engine';
import { useSharedDataDirect } from '@monorepo/collab-engine';

import { TExcalidrawSharedData } from './excalidraw-shared-model';

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
  gridSize: undefined,
  theme: 'light',
  viewBackgroundColor: 'transparent',
};

//

const nodeId = 'todo';

export const ExcalidrawLayerComponent: FC<{
  viewId: string;
  active: boolean;
  viewport: LayerViewportAdapter;
  mode?: string;
}> = ({ active, viewport }) => {
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

  useEffect(() => {
    if (!active || Excalidraw) return;
    (async () => {
      await ensureCss();
      const mod = await import('@excalidraw/excalidraw');
      setExcalidraw(() => (mod as { Excalidraw: FC }).Excalidraw);
    })();
  }, [active, Excalidraw]);

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

  //
  //
  //

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

  // Store last applied hash to avoid unnecessary updates and infinite loops
  const lastHashRef = useRef<string | null>(null);

  // Debounced function for setting drawing data
  const debouncedSetDrawing = useRef(
    debounce(
      (elements: TJsonObject[], hash: string) => {
        sharedData.excalidrawDrawing.set(nodeId, {
          elements,
          hash,
          svg: 'TODO',
        });
      },
      250,
      { maxWait: 250 }
    )
  ).current;

  useEffect(() => {
    // On mount, ensure drawing entry exists
    const d = sharedData.excalidrawDrawing.get(nodeId);
    if (!d) {
      const elements: TJsonObject[] = [];
      const hash = simpleHash(elements);
      sharedData.excalidrawDrawing.set(nodeId, {
        elements,
        hash,
        svg: 'TODO',
      });
      lastHashRef.current = hash;
    } else {
      lastHashRef.current = d.hash as string;
    }
    // Observe remote changes
    sharedData.excalidrawDrawing.observe(() => {
      const me = sharedData.excalidrawDrawing.get(nodeId);
      if (me && me.hash !== lastHashRef.current) {
        lastHashRef.current = me.hash as string;
        if (apiRef.current) {
          apiRef.current.updateScene({
            elements: structuredClone(me.elements) || [],
          });
        }
      }
    });
  }, [sharedData]);

  //

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      const newHash = simpleHash(elements as unknown as TJsonObject[]);
      if (newHash === lastHashRef.current) {
        return; // No actual change
      }
      lastHashRef.current = newHash as string;
      debouncedSetDrawing(elements as unknown as TJsonObject[], newHash);
    },
    [debouncedSetDrawing]
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

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetDrawing.cancel();
    };
  }, [debouncedSetDrawing]);

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
    <div style={{ position: 'absolute', inset: 0 }}>
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawAPI) => {
          apiRef.current = api;
        }}
        initialData={{
          appState: { ...appState, ...toExcalidrawViewport(initialVp) },
          elements:
            (structuredClone(
              sharedData.excalidrawDrawing.get(nodeId)?.elements
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

export const layers: TLayerProvider[] = [
  {
    id: 'excalidraw',
    title: 'Excalidraw',
    zIndexHint: 10,
    Component: ExcalidrawLayerComponent,
  },
];

/*


.demiurge-space {
  &.default,
  &.move-node {
    // remove excalidraw controls
    .layer-ui__wrapper {
      display: none;
    }

    // remove minimap on small screens
    @media (max-width: 640px) {
      .react-flow__panel.react-flow__minimap.bottom.right {
        display: none !important;
      }
    }

    / *
    .FixedSideContainer.FixedSideContainer_side_top {
      display: none;
    }
    .layer-ui__wrapper__footer.App-menu.App-menu_bottom {
      display: none;
    }
      * /
}
&.drawing {
  // remove reactflow controls
  .react-flow__panel.react-flow__controls.vertical.bottom.left {
    display: none;
  }
  .react-flow__panel.react-flow__minimap.bottom.right {
    display: none;
  }
}

// remove excalidraw bottom bar on small screens
.App-bottom-bar {
  display: none;
}
}
*/
