import React, {
  useCallback,
  useRef,
  useMemo,
  FC,
  useEffect,
  forwardRef,
} from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Node,
  Viewport as ReactFlowViewport,
  EdgeTypes,
  NodeTypes,
  Connection,
  EdgeProps,
  Background,
  FinalConnectionState,
  ReactFlowInstance,
  useReactFlow,
  OnConnectStart,
  OnMove,
} from '@xyflow/react';

import { TJsonObject } from '@holistix-forge/simple-types';
import { useRegisterListener } from '@holistix-forge/ui-toolkit/frontend';
import { clientXY } from '@holistix-forge/ui-toolkit';
import {
  TPosition,
  TEdge,
  TEdgeEnd,
  EEdgeSemanticType,
} from '@holistix-forge/core-graph';
import {
  useAwareness,
  TValidSharedDataToCopy,
  useLocalSharedDataManager,
  TOverrideFunction,
} from '@holistix-forge/collab/frontend';
import {
  FrontendEventSequence,
  useDispatcher,
} from '@holistix-forge/reducers/frontend';

import { PointerTracker } from './PointerTracker';
import { NodeWrapper } from './node-wrappers/node-wrapper';
import { WhiteboardState } from './apis/whiteboardState';
import { translateEdges, translateNodes } from './to-rf-nodes';
import { TEventMoveNode } from '../whiteboard-events';
import { getAbsolutePosition } from '../utils/position-utils';
import { TWhiteboardSharedData } from '../..';
import { INITIAL_VIEWPORT } from './whiteboard';
import { useSpaceContext } from './reactflow-layer-context';
import { LayerViewport, LayerViewportAdapter } from './layer-types';

//
//

const toReactFlowViewport = (viewport: LayerViewport) => {
  return {
    x: viewport.absoluteX * viewport.zoom,
    y: viewport.absoluteY * viewport.zoom,
    zoom: viewport.zoom,
  };
};

//
//

export type ReactflowLayerProps = {
  viewId: string;
  active: boolean;
  nodeComponent: FC;
  edgeComponent: FC<EdgeProps>;
  spaceState: WhiteboardState;
  pointerTracker: PointerTracker;
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
  onConnect: (edge: TEdge) => void;
  onDrop: ({
    data,
    position,
  }: {
    data: TJsonObject;
    position: TPosition;
  }) => void;
  viewport: LayerViewportAdapter;
};

/**
 *
 *
 */

export const ReactflowLayer = ({
  viewId,
  active,
  nodeComponent,
  edgeComponent,
  spaceState,
  pointerTracker,
  viewport: viewportAdapter,
  onContextMenu,
  onContextMenuNewEdge,
  onConnect,
  onDrop,
}: ReactflowLayerProps) => {
  const reactflowRef = useRef<ReactFlowInstance | null>(null);

  useRegisterListener(spaceState, 'Whiteboard', viewId);

  //
  // ***************  ***************
  //

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      wrapper: NodeWrapper(nodeComponent) as FC,
    }),
    [nodeComponent]
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      custom: edgeComponent,
    }),
    [edgeComponent]
  );

  //
  // *************** ***************
  //

  const connectingNodeId = useRef<TEdgeEnd | null>(null);

  /**
   * just convert react flow type to our's
   */
  const _onConnect = useCallback(
    (c: Connection) => {
      let semanticType: EEdgeSemanticType = '_unknown_';
      if (
        c.sourceHandle === 'easy-connect-source' ||
        c.targetHandle === 'easy-connect-target'
      ) {
        semanticType = 'easy-connect';
      }
      const e: TEdge = {
        from: {
          node: c.source as string,
          connectorName: c.sourceHandle || 'outputs',
        },
        to: {
          node: c.target as string,
          connectorName: c.targetHandle || 'inputs',
        },
        semanticType,
      };
      onConnect?.(e);
    },
    [onConnect]
  );

  //
  //

  /** we store the connector from wich an edge is draw to attach new node when
   * user will mouseup. */

  const onConnectStart: OnConnectStart = useCallback((_, p) => {
    const { nodeId, handleId, handleType } = p;
    if (handleType === 'source')
      connectingNodeId.current = {
        node: nodeId || '',
        connectorName: handleId || '',
      };
    else connectingNodeId.current = null;
  }, []);

  //
  //

  /** if user stop edge draw above nothing, we open the context menu */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      console.log('onConnectEnd', event, connectionState);
      const targetIsPane = connectionState.toNode === null;

      if (targetIsPane && connectingNodeId.current) {
        const pclient = clientXY(event);
        const p = pointerTracker.fromMouseEvent(pclient);
        onContextMenuNewEdge(connectingNodeId.current, p, pclient);
      }
    },
    [onContextMenuNewEdge, pointerTracker]
  );

  //
  //

  const dispatcher = useDispatcher<TEventMoveNode>();

  const lsdm = useLocalSharedDataManager<TWhiteboardSharedData>();

  const { handleNodeDrag, handleNodeDragStop } = useMemo(() => {
    //

    // function to move the node in local shared data
    const moveNodeLocally = (
      localSharedData: TValidSharedDataToCopy<TWhiteboardSharedData>,
      nodeId: string,
      event: TEventMoveNode
    ) => {
      // define the local state override applied to shared state locally during the sequence life
      const gv = localSharedData['whiteboard:graphViews'].get(viewId);
      if (!gv) return;

      const draggedNode = gv.graph.nodes.find((n) => n.id === nodeId);

      if (draggedNode) {
        // if action is done and node has a group id, return.
        if (draggedNode.parentId)
          // the very last overide, (backend have computed group) draggedNode.parentId will be the group id,
          // and event.position will still be absolute.
          // do nothing.
          return;

        draggedNode.position = getAbsolutePosition(
          event.position,
          draggedNode.parentId,
          gv
        );
        draggedNode.parentId = undefined;
      }
    };

    // create an event sequence that both dispatches the event to backend
    // and applies the node properties to the local shared data
    const es = new FrontendEventSequence<TEventMoveNode>(
      dispatcher,
      (event) => {
        lsdm.apply(localOverrider);
      }
    );

    // register an override function to apply the node properties to the local shared data
    // when the shared data is updated (pushed from backend)
    const localOverrider: TOverrideFunction<
      TValidSharedDataToCopy<TWhiteboardSharedData>
    > = {
      apply: (localSharedData) => {
        if (es.lastEvent)
          moveNodeLocally(localSharedData, es.lastEvent.nid, es.lastEvent);
      },
      keys: ['whiteboard:graphViews'],
    };

    lsdm.registerOverrideFunction(localOverrider);

    // on node drag, we dispatch an event to backend through the event sequence
    // object that handle debouncing, sequence id and sequence counter, and also applies
    // the node properties to the local shared data
    const handleNodeDrag = (
      event: React.MouseEvent,
      node: Node,
      nodes: Node[],
      end = false
    ) => {
      const nodeView = spaceState.getNodes().find((n) => n.id === node.id);
      if (!nodeView) return;
      if (nodeView.disabledFeatures?.includes('frontend-move-node')) {
        console.log('node is disabled for moving');
        return;
      }
      es.dispatch({
        type: 'whiteboard:move-node',
        viewId,
        nid: node.id,
        position: node.position,
        stop: end,
        sequenceEnd: end,
      });

      if (end) {
        es.reset();
      }
    };

    const handleNodeDragStop = (
      event: React.MouseEvent,
      node: Node,
      nodes: Node[]
    ) => {
      handleNodeDrag(event, node, nodes, true);
    };

    return {
      handleNodeDrag,
      handleNodeDragStop,
    };
  }, [dispatcher, lsdm, spaceState, viewId]);

  //
  //

  /**
   * This event handler is called while the user is either panning or zooming the viewport.
   */
  const _onMove: OnMove = useCallback(
    (event, viewport: ReactFlowViewport) => {
      viewportAdapter.onViewportChange({
        absoluteX: viewport.x / viewport.zoom,
        absoluteY: viewport.y / viewport.zoom,
        zoom: viewport.zoom,
      });
    },
    [viewportAdapter]
  );

  const setViewport = useCallback((viewport: LayerViewport) => {
    if (reactflowRef.current) {
      const vp = toReactFlowViewport(viewport);
      reactflowRef.current.setViewport(vp);
    }
  }, []);

  useEffect(() => {
    viewportAdapter.registerViewportChangeCallback(setViewport);
  }, [viewportAdapter, setViewport]);

  //

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const targetIsPane = (event.target as HTMLElement).classList.contains(
        'react-flow__pane'
      );
      if (targetIsPane) event.dataTransfer.dropEffect = 'move';
      else event.dataTransfer.dropEffect = 'none';
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const pclient = clientXY(event);
      const p = pointerTracker.fromMouseEvent(pclient);
      try {
        const jsonData = event.dataTransfer.getData('application/json');
        const data = JSON.parse(jsonData);
        onDrop?.({ data, position: p });
      } catch (err) {
        console.error('Drop error:', err);
      }
    },
    [onDrop, pointerTracker]
  );

  /**
   * capture the pointer coordinates in the canvas when user right click on background
   */
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const pclient = clientXY(event);
      const p = pointerTracker.fromMouseEvent(pclient);
      onContextMenu(p, pclient);
      event.preventDefault();
    },
    [onContextMenu, pointerTracker]
  );

  //

  const { awareness } = useAwareness();

  //

  const { resetEdgeMenu } = useSpaceContext();

  const handlePaneClick = useCallback(
    // Handle left click on pane here
    (event: React.MouseEvent) => {
      awareness.emitSelectionAwareness({
        nodes: [],
        viewId,
      });
      // const pclient = clientXY(event);
      // const p = pointerTracker.fromMouseEvent(pclient);
      event.preventDefault();
      resetEdgeMenu();
    },
    [awareness, resetEdgeMenu, viewId]
  );

  //

  /**
   * render
   */

  return (
    <ReactFlow
      style={{
        pointerEvents: active ? 'all' : 'none',
      }}
      className={active ? 'active' : ''}
      defaultViewport={toReactFlowViewport(INITIAL_VIEWPORT)}
      maxZoom={1}
      minZoom={0.001}
      nodes={translateNodes(spaceState.getNodes(), viewId)}
      edges={translateEdges(spaceState.getEdges())}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onConnect={_onConnect}
      onConnectEnd={onConnectEnd}
      onConnectStart={onConnectStart}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
      onMove={_onMove}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaneClick={handlePaneClick}
      onContextMenu={handleContextMenu}
    >
      <MiniMap />
      <Controls />
      <Background />
      <ReactflowInstanceSetter ref={reactflowRef} />
    </ReactFlow>
  );
};

//
//
//

const ReactflowInstanceSetter = forwardRef<ReactFlowInstance, unknown>(
  (unknown, ref) => {
    const reactflowInstance = useReactFlow();
    useEffect(() => {
      if (ref && 'current' in ref) {
        ref.current = reactflowInstance;
      }
    }, [reactflowInstance, ref]);
    return null;
  }
);
