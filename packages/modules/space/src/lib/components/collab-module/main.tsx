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
  useShareDataManager,
} from '@monorepo/collab-engine';

import { DemiurgeSpace } from '../reactflow-renderer/demiurge-space';
import { ReactflowPointerTracker } from '../reactflow-renderer/reactflowPointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { CustomStoryEdge } from '../reactflow-renderer/edge';

import { CollabSpaceState } from './collab-space-state';
import { CollabSpaceAwareness } from './collab-space-awareness';
import { useNodeContext } from '../reactflow-renderer/node-wrappers/node-wrapper';
import { CustomStoryNode } from '../reactflow-renderer/node';
import { TSpaceSharedData } from '../../space-shared-model';

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
  onContextMenu,
  onContextMenuNewEdge,
}: {
  viewId: string;
  nodeTypes: TNodeTypes;
  onContextMenu?: (xy: TPosition, clientPosition: TPosition) => void;
  onContextMenuNewEdge?: (
    from: TEdgeEnd,
    xy: TPosition,
    clientPosition: TPosition
  ) => void;
}) => {
  //
  const sdm = useShareDataManager<TSpaceSharedData & TCoreSharedData>();
  const collabDispatcher = useDispatcher();
  const { awareness } = useAwareness();

  const logics = useMemo(() => {
    const ga = new CollabSpaceAwareness(viewId, awareness);
    const pt = new ReactflowPointerTracker(ga);
    const as = new HtmlAvatarStore(pt, ga);
    const ss = new CollabSpaceState(viewId, sdm);

    const Node = makeSpaceModuleNode(nodeTypes);

    return { ga, pt, as, ss, Node };
  }, []);

  const onDrop = useCallback(
    ({ data, position }: { data: any; position: TPosition }) => {
      console.log({ data, position });
      collabDispatcher.dispatch({ ...data, origin: { position, viewId } });
    },
    []
  );

  const onConnect = useCallback((edge: TEdge) => {
    console.log({ edge });
    collabDispatcher.dispatch({
      type: 'core:new-edge',
      edge,
    });
  }, []);

  return (
    <DemiurgeSpace
      viewId={viewId}
      spaceState={logics.ss}
      currentUser={awareness._user || undefined}
      spaceAwareness={logics.ga}
      pointerTracker={logics.pt}
      avatarsStore={logics.as}
      reactflow={{
        nodeComponent: logics.Node,
        edgeComponent: CustomStoryEdge,
        onContextMenu: onContextMenu || (() => {}),
        onContextMenuNewEdge: onContextMenuNewEdge || (() => {}),
        onDrop: onDrop,
        onConnect: onConnect,
      }}
    />
  );
};
