import { useCallback, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { ExcalidrawLayer } from './excalidraw-layer';
import { PointerTracker } from '../apis/pointerTracker';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { AvatarsRenderer } from './avatarsRenderer';
import { ReactflowLayer, ReactflowLayerProps } from './reactflow-layer';
import { SpaceContext } from './spaceContext';
import { SpaceState } from '../apis/spaceState';
import { SpaceAwareness } from '../apis/spaceAwareness';

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
  spaceAwareness,
  currentUser,
  viewId,
  reactflow,
}: {
  pointerTracker: PointerTracker;
  avatarsStore: HtmlAvatarStore;
  spaceState: SpaceState;
  spaceAwareness: SpaceAwareness;
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

  const context = useMemo(
    () => ({
      spaceAwareness,
      spaceState,
      currentUser,
      mode,
      viewId,
    }),
    [mode]
  );

  return (
    <SpaceContext value={context}>
      <div
        className={`demiurge-space ${mode}`}
        style={{ width: '100%', height: '100%', position: 'relative' }}
        ref={pointerTracker.bindReactFlowParentDiv.bind(pointerTracker)}
        onWheelCapture={(e) => {
          // Stop Excalidraw scroll wich pane toward bottom instead of zooming
          mode === 'drawing' && e.stopPropagation();
        }}
      >
        <ExcalidrawLayer
          mode={mode}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        <ReactflowLayer
          viewId={viewId}
          nodeComponent={reactflow.nodeComponent}
          edgeComponent={reactflow.edgeComponent}
          spaceState={spaceState}
          spaceAwareness={spaceAwareness}
          pointerTracker={pointerTracker}
          avatarsStore={avatarsStore}
          onContextMenu={reactflow.onContextMenu}
          onContextMenuNewEdge={reactflow.onContextMenuNewEdge}
          onConnect={reactflow.onConnect}
          onDrop={reactflow.onDrop}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        <AvatarsRenderer avatarsStore={avatarsStore} />
        <ModeIndicator mode={mode} />
      </div>
    </SpaceContext>
  );
};

//

export const ModeIndicator = ({ mode }: { mode: WhiteboardMode }) => {
  if (mode === 'default') {
    return null;
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        padding: '5px 10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 5,
      }}
    >
      {mode === 'move-node'
        ? 'Move Node Mode Active (Shift+Z to toggle)'
        : 'Drawing Mode Active (Shift+D to toggle)'}
    </div>
  );
};
