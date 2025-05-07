import React, { useCallback, useRef, useMemo, FC, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Node,
  Viewport,
  EdgeTypes,
  NodeTypes,
  Connection,
  EdgeProps,
  Background,
  FinalConnectionState,
} from '@xyflow/react';
import * as _ from 'lodash';
import { useHotkeys } from 'react-hotkeys-hook';

import { useRegisterListener } from '@monorepo/simple-types';
import { clientXY } from '@monorepo/ui-toolkit';
import { TPosition, TEdge, TEdgeEnd, EEdgeType } from '@monorepo/core';
import { useDispatcher, Sequence } from '@monorepo/collab-engine';

import { PointerTracker } from '../apis/pointerTracker';
import { AvatarsRenderer } from './avatarsRenderer';
import { SpaceContext } from './spaceContext';
import { NodeWrapper } from './node-wrappers/node-wrapper';
import { SpaceState } from '../apis/spaceState';
import { SpaceAwareness } from '../apis/spaceAwareness';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { translateEdges, translateNodes } from './to-rf-nodes';
import { TSpaceEvent } from '../../space-events';
//
//

type DemiurgeSpaceProps = {
  viewId: string;
  //
  nodeComponent: FC;
  edgeComponent: FC<EdgeProps>;
  spaceState: SpaceState;
  spaceAwareness: SpaceAwareness;
  pointerTracker: PointerTracker;
  avatarsStore: HtmlAvatarStore;
  currentUser: { username: string; color: string } | undefined;
  //
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
  onPaneClick?: (xy: TPosition, clientPosition: TPosition) => void;
  //
  onContextMenuNewEdge: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
  onConnect?: (edge: TEdge) => void;
  onDrop?: ({ data, position }: { data: any; position: TPosition }) => void;
};

/**
 *
 *
 */

export const DemiurgeSpace = ({
  viewId,
  nodeComponent,
  edgeComponent,
  spaceState,
  spaceAwareness,
  pointerTracker,
  avatarsStore,
  currentUser,
  onContextMenu,
  onContextMenuNewEdge,
  onConnect,
  onDrop,
  onPaneClick,
}: DemiurgeSpaceProps) => {
  //
  // State to track whether we're in pan-only mode
  const [moveNodeMode, setMoveNodeMode] = useState(false);

  // Toggle pan-only mode with Shift+Z
  useHotkeys(
    'shift+z',
    () => {
      setMoveNodeMode((prevMode) => !prevMode);
    },
    {
      preventDefault: true, // Prevent any default browser behavior
    }
  );

  useRegisterListener(spaceState);

  const dispatcher = useDispatcher<TSpaceEvent>();
  const dragSequenceRef = useRef<Sequence<TSpaceEvent> | null>(null);

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
      let type: EEdgeType = '_unknown_';
      if (
        c.sourceHandle === 'easy-connect-source' ||
        c.targetHandle === 'easy-connect-target'
      ) {
        type = 'easy-connect';
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
        type,
        data: { edgeShape: type === 'easy-connect' ? 'square' : 'bezier' },
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
      // Create sequence if it doesn't exist
      if (!dragSequenceRef.current) {
        dragSequenceRef.current = dispatcher.createSequence();
      }
      dragSequenceRef.current.dispatch({
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
      if (dragSequenceRef.current) {
        // Send final position
        dragSequenceRef.current.dispatch({
          type: 'space:move-node',
          viewId,
          nid: node.id,
          position: node.position,
          stop: true,
        });
        dragSequenceRef.current = null;
      }
    },
    []
  );

  //

  const _onMove = useCallback(
    (event: any, viewport: Viewport) => {
      pointerTracker.onMove(event, viewport);
      avatarsStore.updateAllAvatars();
    },
    [avatarsStore]
  );

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

  const handlePaneClick = useCallback(
    // Handle left click on pane here
    (event: React.MouseEvent) => {
      spaceAwareness.clearNodeSelection();
      const pclient = clientXY(event);
      const p = pointerTracker.fromMouseEvent(pclient);
      onPaneClick?.(p, pclient);
      event.preventDefault();
    },
    [onPaneClick, spaceAwareness]
  );

  //

  const context = useMemo(
    () => ({
      spaceAwareness,
      spaceState,
      currentUser,
      moveNodeMode,
      viewId,
    }),
    [moveNodeMode]
  );

  /**
   * render
   */

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      ref={pointerTracker.bindReactFlowParentDiv.bind(pointerTracker)}
    >
      <SpaceContext value={context}>
        <ReactFlow
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          maxZoom={1}
          minZoom={0.05}
          // todo_ factorise with flow story
          nodes={translateNodes(spaceState.getNodes(), viewId)}
          edges={translateEdges(spaceState.getEdges())}
          //
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          //
          onConnect={_onConnect}
          onConnectEnd={onConnectEnd}
          onConnectStart={onConnectStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          //
          onPaneMouseMove={pointerTracker.onPaneMouseMove.bind(pointerTracker)}
          onPaneMouseLeave={pointerTracker.setPointerInactive.bind(
            pointerTracker
          )}
          onMove={_onMove}
          //
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          //
          onPaneClick={handlePaneClick}
          onContextMenu={handleContextMenu}
        >
          <MiniMap />
          <Controls />
          <Background />
          {/* Indicator when in pan-only mode */}
          {moveNodeMode && (
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
              Move Node Mode Active (Shift+Z to toggle)
            </div>
          )}
        </ReactFlow>
      </SpaceContext>
      <AvatarsRenderer avatarsStore={avatarsStore} />
    </div>
  );
};
