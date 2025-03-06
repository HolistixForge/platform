import { FC, useCallback, useMemo } from 'react';

import {
  TPosition,
  TEdgeEnd,
  TEdge,
  TCoreSharedData,
  TGraphNode,
} from '@monorepo/core';
import {
  useDispatcher,
  useAwareness,
  useSharedData,
} from '@monorepo/collab-engine';

import { DemiurgeSpace } from '../reactflow-renderer/main';
import { ReactflowPointerTracker } from '../reactflow-renderer/reactflowPointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { CustomStoryEdge } from '../local-test/edge';

import { CollabSpaceState } from './collab-space-state';
import { CollabSpaceAwareness } from './collab-space-awareness';
import { CollabSpaceActionsDispatcher } from './collab-space-actions-dispatcher';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';
import { CustomStoryNode } from '../local-test/node';

//

type TNodeTypes = { [key: string]: FC<{ node: TGraphNode }> };

//

const makeSpaceModuleNode = (nodeTypes: TNodeTypes) => {
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

export const SpaceModule = ({
  viewId,
  nodeTypes,
  onConnect,
  onContextMenu,
  onContextMenuNewEdge,
}: {
  viewId: string;
  nodeTypes: TNodeTypes;
  onConnect?: (edge: TEdge) => void;
  onContextMenu?: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge?: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
}) => {
  const sd = useSharedData(['graphViews'], (sd) => sd);
  const collabDispatcher = useDispatcher();
  const { awareness } = useAwareness();

  const logics = useMemo(() => {
    const ga = new CollabSpaceAwareness(viewId, awareness);
    const pt = new ReactflowPointerTracker(ga);
    const as = new HtmlAvatarStore(pt, ga);
    const ss = new CollabSpaceState(viewId, sd);
    const sad = new CollabSpaceActionsDispatcher(viewId, collabDispatcher);

    const Node = makeSpaceModuleNode(nodeTypes);

    return { ga, pt, as, sad, ss, Node };
  }, []);

  const onDrop = useCallback(
    ({ data, position }: { data: any; position: TPosition }) => {
      console.log({ data, position });
      collabDispatcher.dispatch({ ...data, origin: { position, viewId } });
    },
    []
  );

  const onPaneClick = useCallback(
    (xy: TPosition, clientPosition: TPosition) => {
      logics.ga.selectNode('none');
    },
    []
  );

  return (
    <DemiurgeSpace
      viewId={viewId}
      nodeComponent={logics.Node}
      edgeComponent={CustomStoryEdge}
      spaceState={logics.ss}
      spaceActionsDispatcher={logics.sad}
      currentUser={awareness._user || undefined}
      spaceAwareness={logics.ga}
      pointerTracker={logics.pt}
      avatarsStore={logics.as}
      onContextMenu={onContextMenu || (() => {})}
      onContextMenuNewEdge={onContextMenuNewEdge || (() => {})}
      onConnect={onConnect || (() => {})}
      onDrop={onDrop}
      onPaneClick={onPaneClick}
    />
  );
};
