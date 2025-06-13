import { useCallback, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { ExcalidrawLayer } from './excalidraw-layer';
import { PointerTracker } from './PointerTracker';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { AvatarsRenderer } from './avatarsRenderer';
import { ReactflowLayer, ReactflowLayerProps } from './reactflow-layer';
import { SpaceContext } from './spaceContext';
import { SpaceState } from '../apis/spaceState';
import { EdgeMenu } from './assets/edges/edge-menu';
import { edgeId, TEdgeRenderProps } from '../apis/types/edge';
import {
  useDispatcher,
  useEventSequence,
  FrontendEventSequence,
} from '@monorepo/collab-engine';
import { TEventEdgePropertyChange } from '../../space-events';
import { TSpaceSharedData } from '../../space-shared-model';
import { TGraphView } from '../../space-types';

//

export type Viewport = {
  absoluteX: number;
  absoluteY: number;
  zoom: number;
};

//

export type WhiteboardMode = 'default' | 'move-node' | 'drawing';

export const INITIAL_VIEWPORT: Viewport = {
  absoluteX: 0,
  absoluteY: 0,
  zoom: 0.5,
};

//

export const DemiurgeSpace = ({
  pointerTracker,
  avatarsStore,
  spaceState,
  currentUser,
  viewId,
  reactflow,
}: {
  pointerTracker: PointerTracker;
  avatarsStore: HtmlAvatarStore;
  spaceState: SpaceState;
  currentUser: { username: string; color: string } | undefined;
  viewId: string;
  reactflow: Pick<
    ReactflowLayerProps,
    | 'nodeComponent'
    | 'edgeComponent'
    | 'onContextMenu'
    | 'onContextMenuNewEdge'
    | 'onConnect'
    | 'onDrop'
  >;
}) => {
  // Modes state
  const [mode, setMode] = useState<WhiteboardMode>('default');

  // Viewport state
  const lastViewportRef = useRef<Viewport>(INITIAL_VIEWPORT);

  const viewportChangeCallbacks = useRef<((viewport: Viewport) => void)[]>([]);

  // Toggle pan-only mode with Shift+Z
  useHotkeys(
    'shift+z',
    () => {
      setMode(mode === 'move-node' ? 'default' : 'move-node');
    },
    {
      preventDefault: true,
    }
  );

  // Toggle drawing mode with Shift+D
  useHotkeys(
    'shift+d',
    () => {
      setMode(mode === 'drawing' ? 'default' : 'drawing');
    },
    {
      preventDefault: true,
    }
  );

  // Viewport synchronization logic
  const onViewportChange = useCallback((newViewport: Viewport) => {
    if (
      newViewport.absoluteX !== lastViewportRef.current.absoluteX ||
      newViewport.absoluteY !== lastViewportRef.current.absoluteY ||
      newViewport.zoom !== lastViewportRef.current.zoom
    ) {
      lastViewportRef.current = newViewport;
      pointerTracker.onMove(newViewport);
      avatarsStore.updateAllAvatars();
      viewportChangeCallbacks.current.forEach((callback) => {
        callback(newViewport);
      });
    }
  }, []);

  const registerViewportChangeCallback = useCallback(
    (callback: (viewport: Viewport) => void) => {
      viewportChangeCallbacks.current.push(callback);
    },
    []
  );

  //

  const [edgeMenu, _setEdgeMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);

  const setEdgeMenu = useCallback(
    ({ edgeId, x, y }: { edgeId: string; x: number; y: number }) => {
      _setEdgeMenu({ edgeId, x, y });
    },
    []
  );

  const dispatcher = useDispatcher<TEventEdgePropertyChange>();

  // Event sequence for edge renderProps change
  const { createEventSequence } = useEventSequence<
    TEventEdgePropertyChange,
    TSpaceSharedData
  >();
  const renderPropsChangeEventSequenceRef =
    useRef<FrontendEventSequence<TEventEdgePropertyChange> | null>(null);

  // Manage event sequence lifecycle based on edgeMenu
  const prevEdgeIdRef = useRef<string | null>(null);
  if (edgeMenu?.edgeId !== prevEdgeIdRef.current) {
    // Clean up previous sequence if edgeId changed or edgeMenu is null
    if (renderPropsChangeEventSequenceRef.current) {
      renderPropsChangeEventSequenceRef.current.cleanup();
      renderPropsChangeEventSequenceRef.current = null;
    }
    if (edgeMenu?.edgeId) {
      // Create new sequence for this edgeId
      renderPropsChangeEventSequenceRef.current = createEventSequence({
        localReduceUpdateKeys: ['graphViews'],
        localReduce: (sdc, event) => {
          const gv: TGraphView = sdc.graphViews.get(viewId);
          const e = gv.graph.edges.find((e) => edgeId(e) === event.edgeId);
          if (e) {
            (e as any).renderProps = event.properties.renderProps;
          }
        },
      });
    }
    prevEdgeIdRef.current = edgeMenu?.edgeId ?? null;
  }

  const handleRenderPropsChange = useCallback(
    (rp: TEdgeRenderProps) => {
      if (edgeMenu && renderPropsChangeEventSequenceRef.current) {
        renderPropsChangeEventSequenceRef.current.dispatch({
          type: 'space:edge-property-change',
          edgeId: edgeMenu.edgeId,
          properties: { renderProps: rp },
        });
      }
    },
    [dispatcher, edgeMenu]
  );

  const resetEdgeMenu = useCallback(() => {
    _setEdgeMenu(null);
  }, [setEdgeMenu]);

  //

  const context = useMemo(
    () => ({
      spaceState,
      currentUser,
      mode,
      viewId,
      edgeMenu,
      setEdgeMenu,
      resetEdgeMenu,
    }),
    [mode, edgeMenu, setEdgeMenu, resetEdgeMenu]
  );

  return (
    <SpaceContext value={context}>
      <div
        className={`demiurge-space ${mode}`}
        style={{ width: '100%', height: '100%', position: 'relative' }}
        ref={pointerTracker.bindDiv.bind(pointerTracker)}
        onWheelCapture={(e) => {
          // Stop Excalidraw scroll wich pane toward bottom instead of zooming
          mode === 'drawing' && e.stopPropagation();
        }}
        onMouseMove={pointerTracker.onPaneMouseMove.bind(pointerTracker)}
        onMouseLeave={pointerTracker.setPointerInactive.bind(pointerTracker)}
      >
        <ExcalidrawLayer
          viewId={viewId}
          mode={mode}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        <ReactflowLayer
          viewId={viewId}
          nodeComponent={reactflow.nodeComponent}
          edgeComponent={reactflow.edgeComponent}
          spaceState={spaceState}
          pointerTracker={pointerTracker}
          avatarsStore={avatarsStore}
          onContextMenu={reactflow.onContextMenu}
          onContextMenuNewEdge={reactflow.onContextMenuNewEdge}
          onConnect={reactflow.onConnect}
          onDrop={reactflow.onDrop}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        {edgeMenu && (
          <EdgeMenu
            eid={edgeMenu.edgeId}
            position={[edgeMenu.x, edgeMenu.y]}
            setRenderProps={handleRenderPropsChange}
          />
        )}
        <AvatarsRenderer avatarsStore={avatarsStore} />
        <ModeIndicator
          mode={mode}
          onModeChange={setMode}
          onContextMenu={reactflow.onContextMenu}
          lastViewportRef={lastViewportRef}
        />
      </div>
    </SpaceContext>
  );
};

//

export const ModeIndicator = ({
  mode,
  onModeChange,
  onContextMenu,
  lastViewportRef,
}: {
  mode: WhiteboardMode;
  onModeChange: (mode: WhiteboardMode) => void;
  lastViewportRef: React.MutableRefObject<Viewport>;
} & Pick<ReactflowLayerProps, 'onContextMenu'>) => {
  const modes: { key: WhiteboardMode; label: string }[] = [
    { key: 'default', label: 'Normal' },
    { key: 'drawing', label: 'Drawing' },
    { key: 'move-node', label: 'Move Node' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          style={{
            background: mode === m.key ? '#fff' : 'transparent',
            color: mode === m.key ? '#222' : '#fff',
            border: 'none',
            padding: '0px 10px',
            fontWeight: mode === m.key ? 'bold' : 'normal',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, color 0.2s',
            fontSize: '10px',
            height: '30px',
          }}
        >
          {m.label}
        </button>
      ))}

      <button
        onClick={() => {
          const obj = {
            ww: window.innerWidth,
            wh: window.innerHeight,
            zoom: lastViewportRef.current.zoom,
            absX: lastViewportRef.current.absoluteX,
            absY: lastViewportRef.current.absoluteY,
            resX:
              -lastViewportRef.current.absoluteX +
              window.innerWidth / 2 / lastViewportRef.current.zoom,
            resY:
              -lastViewportRef.current.absoluteY +
              window.innerHeight / 2 / lastViewportRef.current.zoom,
          };

          onContextMenu(
            {
              x: obj.resX,
              y: obj.resY,
            },
            { x: window.innerWidth / 2, y: window.innerHeight / 2 }
          );
        }}
        style={{
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: '0px 10px',
          fontWeight: 'normal',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.2s, color 0.2s',
          fontSize: '10px',
          height: '30px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        +
      </button>
    </div>
  );
};
