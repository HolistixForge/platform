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
} from '@xyflow/react';
import * as _ from 'lodash';
import { useRegisterListener } from '@monorepo/simple-types';
import { clientXY } from '@monorepo/ui-toolkit';
import { TPosition, TEdge, TEdgeEnd, EEdgeSemanticType } from '@monorepo/core';
import {
  useEventSequence,
  FrontendEventSequence,
  useAwareness,
} from '@monorepo/collab-engine';

import { PointerTracker } from './PointerTracker';
import { NodeWrapper } from './node-wrappers/node-wrapper';
import { SpaceState } from '../apis/spaceState';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { translateEdges, translateNodes } from './to-rf-nodes';
import { TSpaceEvent } from '../../space-events';
import { getAbsolutePosition } from '../../utils/position-utils';
import { TSpaceSharedData } from '../../space-shared-model';
import { Viewport, INITIAL_VIEWPORT } from './demiurge-space';
import { useSpaceContext } from './spaceContext';
//
//

const toReactFlowViewport = (viewport: Viewport) => {
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
  nodeComponent: FC;
  edgeComponent: FC<EdgeProps>;
  spaceState: SpaceState;
  pointerTracker: PointerTracker;
  avatarsStore: HtmlAvatarStore;
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
  onConnect: (edge: TEdge) => void;
  onDrop: ({ data, position }: { data: any; position: TPosition }) => void;
  onViewportChange: (viewport: Viewport) => void;
  registerViewportChangeCallback: (
    callback: (viewport: Viewport) => void
  ) => void;
};

/**
 *
 *
 */

export const ReactflowLayer = ({
  viewId,
  nodeComponent,
  edgeComponent,
  spaceState,
  pointerTracker,
  avatarsStore,
  onViewportChange,
  registerViewportChangeCallback,
  onContextMenu,
  onContextMenuNewEdge,
  onConnect,
  onDrop,
}: ReactflowLayerProps) => {
  const reactflowRef = useRef<ReactFlowInstance | null>(null);

  useRegisterListener(spaceState, 'DemiurgeSpace', viewId);

  const { createEventSequence } = useEventSequence<
    TSpaceEvent,
    TSpaceSharedData
  >();
  const moveNodeEventSequenceRef =
    useRef<FrontendEventSequence<TSpaceEvent> | null>(null);

  //
  // ***************  ***************
  //

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      wrapper: NodeWrapper(nodeComponent) as any,
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

  const onConnectStart = useCallback((_: any, p: any) => {
    const { nodeId, handleId, handleType } = p;
    if (handleType === 'source')
      connectingNodeId.current = {
        node: nodeId,
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
    [onContextMenuNewEdge]
  );

  //
  //

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node, nodes: Node[]) => {
      const n = spaceState.getNodes().find((n) => n.id === node.id);
      if (!n) return;
      // Create sequence if it doesn't exist
      if (!moveNodeEventSequenceRef.current) {
        moveNodeEventSequenceRef.current = createEventSequence({
          localReduceUpdateKeys: ['graphViews'],
          localReduce: (sdc, event) => {
            // define the local state override applied to shared state locally during the sequence life
            const gv = sdc.graphViews.get(viewId);
            const draggedNode = gv.graph.nodes.find(
              (n: any) => n.id === node.id
            );

            if (draggedNode) {
              // if action is done and node has a group id, return.
              if (!moveNodeEventSequenceRef.current && draggedNode.parentId)
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
          },
        });
        // define the revert state in case of error during the sequence
        moveNodeEventSequenceRef.current.dispatch({
          type: 'space:move-node',
          viewId,
          nid: node.id,
          position: n.position,
          sequenceRevertPoint: true,
        });
      }
      // start moving the node
      moveNodeEventSequenceRef.current.dispatch({
        type: 'space:move-node',
        viewId,
        nid: node.id,
        position: node.position,
      });
    },
    []
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, nodes: Node[]) => {
      if (moveNodeEventSequenceRef.current) {
        // Send final position
        moveNodeEventSequenceRef.current.dispatch({
          type: 'space:move-node',
          viewId,
          nid: node.id,
          position: node.position,
          stop: true,
          sequenceEnd: true,
        });
        // cleanup the sequence, delete the local state override
        moveNodeEventSequenceRef.current.cleanup();
        moveNodeEventSequenceRef.current = null;
      }
    },
    []
  );

  //

  /**
   * This event handler is called while the user is either panning or zooming the viewport.
   */
  const _onMove = useCallback(
    (event: any, viewport: ReactFlowViewport) => {
      onViewportChange({
        absoluteX: viewport.x / viewport.zoom,
        absoluteY: viewport.y / viewport.zoom,
        zoom: viewport.zoom,
      });
    },
    [avatarsStore, onViewportChange]
  );

  const setViewport = useCallback((viewport: Viewport) => {
    if (reactflowRef.current) {
      const vp = toReactFlowViewport(viewport);
      reactflowRef.current.setViewport(vp);
    }
  }, []);

  useEffect(() => {
    registerViewportChangeCallback(setViewport);
  }, []);

  //

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const targetIsPane = (event as any).target.classList.contains(
        'react-flow__pane'
      );
      if (targetIsPane) event.dataTransfer.dropEffect = 'move';
      else event.dataTransfer.dropEffect = 'none';
    },
    []
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
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
  }, []);

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
    [onContextMenu]
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
    [awareness, resetEdgeMenu]
  );

  //

  /**
   * render
   */

  return (
    <ReactFlow
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
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
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

const ReactflowInstanceSetter = forwardRef<ReactFlowInstance, {}>(({}, ref) => {
  const reactflowInstance = useReactFlow();
  useEffect(() => {
    if (ref && 'current' in ref) {
      ref.current = reactflowInstance;
    }
  }, [reactflowInstance]);
  return null;
});
