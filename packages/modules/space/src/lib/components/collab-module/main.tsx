import { FC, useMemo } from 'react';

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
}: {
  viewId: string;
  nodeTypes: TNodeTypes;
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

  return (
    <DemiurgeSpace
      viewId={'view-story'}
      nodeComponent={logics.Node}
      edgeComponent={CustomStoryEdge}
      spaceState={logics.ss}
      spaceActionsDispatcher={logics.sad}
      currentUser={{ username: 'User-0', color: '#ffa500' }}
      spaceAwareness={logics.ga}
      pointerTracker={logics.pt}
      avatarsStore={logics.as}
      onContextMenu={function (xy: TPosition, clientPosition: TPosition): void {
        alert('Function not implemented.');
      }}
      onContextMenuNewEdge={function (
        from: TEdgeEnd,
        xy: TPosition,
        clientPosition: TPosition
      ): void {
        alert('Function not implemented.');
      }}
      onConnect={function (edge: TEdge): void {
        alert('Function not implemented.');
      }}
    />
  );
};
