import React, { useCallback, useRef, useMemo, FC } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Node,
  Viewport,
  EdgeTypes,
  NodeTypes,
  Connection,
  EdgeProps,
  Background,
  NodeChange,
} from 'reactflow';

import { TEdge, TEdgeEnd, TPosition } from '@monorepo/demiurge-types';
import { PointerTracker } from '../apis/pointerTracker';
import { AvatarsRenderer, useRegisterListener } from './avatarsRenderer';
import { clientXY } from '@monorepo/ui-toolkit';
import { SpaceContext } from './spaceContext';
import * as _ from 'lodash';
import { NodeWrapper } from './node-wrappers/node-wrapper';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';
import { SpaceState } from '../apis/spaceState';
import { SpaceAwareness } from '../apis/spaceAwareness';
import { HtmlAvatarStore } from './htmlAvatarStore';
import { translateEdges, translateNodes } from './to-rf-nodes';

//
//

type DemiurgeSpaceProps = {
  viewId: string;
  //
  nodeComponent: FC;
  edgeComponent: FC<EdgeProps>;
  spaceState: SpaceState;
  spaceActionsDispatcher: SpaceActionsDispatcher;
  spaceAwareness: SpaceAwareness;
  pointerTracker: PointerTracker;
  avatarsStore: HtmlAvatarStore;
  currentUser: { username: string; color: string } | undefined;
  //
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
  onConnect: (edge: TEdge) => void;
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
  spaceActionsDispatcher,
  spaceAwareness,
  pointerTracker,
  avatarsStore,
  currentUser,
  onContextMenu,
  onContextMenuNewEdge,
  onConnect,
}: DemiurgeSpaceProps) => {
  //

  useRegisterListener(spaceState);

  //
  // ***************  ***************
  //

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      wrapper: NodeWrapper(nodeComponent),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: Connection) => {
      const e: TEdge = {
        from: {
          node: c.source as string,
          connector: c.sourceHandle || undefined,
        },
        to: {
          node: c.target as string,
          connector: c.targetHandle || undefined,
        },
        type: '_unknown_',
      };
      onConnect(e);
    },
    [onConnect]
  );

  //
  //

  const onSelectionChange = useCallback((changes: NodeChange[]) => {
    changes.forEach((change) => {
      if (change.type === 'select') {
        if (change.selected) spaceAwareness.selectNode(change.id);
      }
    });
  }, []);

  /** we store the connector from wich an edge is draw to attach new node when
   * user will mouseup. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onConnectStart = useCallback((_: any, p: any) => {
    const { nodeId, handleId, handleType } = p;
    if (handleType === 'source')
      connectingNodeId.current = {
        node: nodeId,
        connector: handleId || undefined,
      };
    else connectingNodeId.current = null;
  }, []);

  //
  //

  /** if user stop edge draw above nothing, we create a new edge */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetIsPane = (event as any).target.classList.contains(
        'react-flow__pane'
      );

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
    _.debounce(
      (event: React.MouseEvent, node: Node, nodes: Node[]) => {
        const { x, y } = node.position;
        spaceActionsDispatcher.dispatch({
          type: 'move-node',
          nid: node.id,
          position: { x, y },
        });
      },
      25,
      { maxWait: 25 }
    ),
    []
  );

  //

  const _onMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any, viewport: Viewport) => {
      pointerTracker.onMove(event, viewport);
      avatarsStore.updateAllAvatars();
    },
    [avatarsStore]
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
    [onContextMenu]
  );

  const context = useMemo(
    () => ({
      spaceAwareness,
      spaceActionsDispatcher,
      spaceState,
      currentUser,
    }),
    []
  );

  /**
   * render
   */

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      ref={pointerTracker.bindReactFlowParentDiv.bind(pointerTracker)}
      onContextMenu={handleContextMenu}
    >
      <SpaceContext value={context}>
        <ReactFlow
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
          onNodesChange={onSelectionChange}
          //
          onPaneMouseMove={pointerTracker.onPaneMouseMove.bind(pointerTracker)}
          onPaneMouseLeave={pointerTracker.setPointerInactive.bind(
            pointerTracker
          )}
          onMove={_onMove}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </SpaceContext>
      <AvatarsRenderer avatarsStore={avatarsStore} />
    </div>
  );
};
