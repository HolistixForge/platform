import { FC, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  TPosition,
  TEdge,
  TCoreSharedData,
  TEventNewEdge,
  TEdgeEnd,
} from '@monorepo/core';
import { TGraphNode } from '@monorepo/module';
import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import {
  useDispatcher,
  useAwareness,
  useSharedData,
  useShareDataManager,
  useEventSequence,
  FrontendEventSequence,
} from '@monorepo/collab-engine';

import { PointerTracker } from './PointerTracker';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { CollabSpaceState } from './collab-space-state';
import { useNodeContext } from './node-wrappers/node-wrapper';
import { CustomStoryNode } from './node';
import { TSpaceSharedData } from '../space-shared-model';
import { TEventEdgePropertyChange } from '../space-events';
import { TGraphView } from '../space-types';
import { ContextualMenu } from './contextual-menu';
import { edgeId, TEdgeRenderProps } from './apis/types/edge';
import { SpaceContext } from './spaceContext';
import { AvatarsRenderer } from './avatarsRenderer';
import { ReactflowLayer } from './reactflow-layer';
import { ExcalidrawLayer } from './excalidraw-layer';
import { EdgeMenu } from './assets/edges/edge-menu';
import { CustomStoryEdge } from './edge';

//

type TNodeTypes = { [key: string]: FC<{ node: TGraphNode }> };

//

export type WhiteboardMode = 'default' | 'move-node' | 'drawing';

//

export type Viewport = {
  absoluteX: number;
  absoluteY: number;
  zoom: number;
};

//

export const INITIAL_VIEWPORT: Viewport = {
  absoluteX: 0,
  absoluteY: 0,
  zoom: 0.5,
};

//

const makeSpaceNode = (nodeTypes: TNodeTypes) => {
  return () => {
    const nodeContext = useNodeContext();
    const node: TGraphNode | undefined = useSharedData<TCoreSharedData>(
      ['nodes'],
      (sd) => sd.nodes.get(nodeContext.id)
    );

    if (node) {
      const NodeComponent = nodeTypes[node.type];

      if (NodeComponent) {
        return <NodeComponent node={node} />;
      }
    }

    return <CustomStoryNode data={node?.data} type={node?.type} />;
  };
};

//

export type HolistixSpaceProps = {
  viewId: string;
  nodeTypes: TNodeTypes;
  spaceMenuEntries: TSpaceMenuEntries;
};

//

//

const useOpenRadixContextMenu = () => {
  const triggerRef = useRef<HTMLSpanElement>(null);

  const open = useCallback((clientPosition: TPosition) => {
    triggerRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: clientPosition.x,
        clientY: clientPosition.y,
      })
    );
  }, []);

  return { triggerRef, open };
};

//
//
//

export const HolistixSpace = ({
  viewId,
  nodeTypes,
  spaceMenuEntries,
}: HolistixSpaceProps) => {
  //
  const sdm = useShareDataManager<TSpaceSharedData & TCoreSharedData>();

  const dispatcher = useDispatcher<TEventEdgePropertyChange | TEventNewEdge>();

  const { awareness } = useAwareness();

  const logics = useMemo(() => {
    const pt = new PointerTracker(viewId, awareness);
    const as = new HtmlAvatarStore(viewId, pt, awareness);
    const ss = new CollabSpaceState(viewId, sdm);

    const Node = makeSpaceNode(nodeTypes);

    return { pt, as, ss, Node };
  }, []);

  /**
   * Contextual menu logics
   */

  // right click coordinates
  const rcc = useRef<TPosition>({ x: 0, y: 0 });

  // new edge's origin handle
  const [from, setFrom] = useState<TEdgeEnd | undefined>(undefined);

  const { triggerRef: ContextualMenuTriggerRef, open: openContextualMenu } =
    useOpenRadixContextMenu();

  // capture the pointer coordinates in the canvas when user right click
  const handleContextualMenu = useCallback(
    (xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(undefined);
      openContextualMenu(clientPosition);
    },
    [openContextualMenu]
  );

  // callback when user draw an edge and end not to another connector.
  // Open a menu to propose creation of a new node.
  const handleContextualMenuNewEdge = useCallback(
    (from: TEdgeEnd, xy: TPosition, clientPosition: TPosition) => {
      rcc.current = xy;
      setFrom(from);
      openContextualMenu(clientPosition);
    },
    [openContextualMenu]
  );

  /**
   *
   */

  const onDrop = useCallback(
    ({ data, position }: { data: any; position: TPosition }) => {
      console.log({ data, position });
      dispatcher.dispatch({ ...data, origin: { position, viewId } });
    },
    []
  );

  const onConnect = useCallback((edge: TEdge) => {
    console.log({ edge });
    dispatcher.dispatch({
      type: 'core:new-edge',
      edge,
    });
  }, []);

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
      logics.pt.onMove(newViewport);
      logics.as.updateAllAvatars();
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
      spaceState: logics.ss,
      currentUser: awareness._user || undefined,
      mode,
      viewId,
      edgeMenu,
      setEdgeMenu,
      resetEdgeMenu,
    }),
    [mode, edgeMenu, setEdgeMenu, resetEdgeMenu]
  );

  const [renderForm, setRenderForm] = useState<ReactNode | null>(null);

  /**
   *
   */

  return (
    <SpaceContext value={context}>
      <div
        className={`demiurge-space ${mode}`}
        style={{ width: '100%', height: '100%', position: 'relative' }}
        ref={logics.pt.bindDiv.bind(logics.pt)}
        onWheelCapture={(e) => {
          // Stop Excalidraw scroll wich pane toward bottom instead of zooming
          mode === 'drawing' && e.stopPropagation();
        }}
        onMouseMove={logics.pt.onPaneMouseMove.bind(logics.pt)}
        onMouseLeave={logics.pt.setPointerInactive.bind(logics.pt)}
      >
        <ExcalidrawLayer
          viewId={viewId}
          mode={mode}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        <ReactflowLayer
          mode={mode}
          viewId={viewId}
          nodeComponent={logics.Node}
          edgeComponent={CustomStoryEdge}
          spaceState={logics.ss}
          pointerTracker={logics.pt}
          avatarsStore={logics.as}
          onContextMenu={handleContextualMenu}
          onContextMenuNewEdge={handleContextualMenuNewEdge}
          onConnect={onConnect}
          onDrop={onDrop}
          onViewportChange={onViewportChange}
          registerViewportChangeCallback={registerViewportChangeCallback}
        />
        <AvatarsRenderer avatarsStore={logics.as} />
        {edgeMenu && (
          <EdgeMenu
            eid={edgeMenu.edgeId}
            position={[edgeMenu.x, edgeMenu.y]}
            setRenderProps={handleRenderPropsChange}
          />
        )}
        <ContextualMenu
          triggerRef={ContextualMenuTriggerRef}
          entries={spaceMenuEntries({
            viewId,
            from,
            sd: sdm.getData(),
            position: () => rcc.current,
            renderForm: setRenderForm,
            dispatcher,
          })}
        />
        {renderForm}

        <ModeIndicator
          mode={mode}
          onModeChange={setMode}
          onContextMenu={handleContextualMenu}
          lastViewportRef={lastViewportRef}
        />
      </div>
    </SpaceContext>
  );
};

//
//
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
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
}) => {
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
