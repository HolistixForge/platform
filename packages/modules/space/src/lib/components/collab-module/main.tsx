import { FC, useCallback, useMemo } from 'react';

import { TPosition, TEdgeEnd, TEdge, TCoreSharedData } from '@monorepo/core';
import { TGraphNode } from '@monorepo/module';
import {
  useDispatcher,
  useAwareness,
  useSharedData,
  useShareDataManager,
} from '@monorepo/collab-engine';

import { DemiurgeSpace } from '../reactflow-renderer/demiurge-space';
import { PointerTracker } from '../reactflow-renderer/PointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { CustomStoryEdge } from '../reactflow-renderer/edge';

import { CollabSpaceState } from './collab-space-state';
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
    const pt = new PointerTracker(viewId, awareness);
    const as = new HtmlAvatarStore(viewId, pt, awareness);
    const ss = new CollabSpaceState(viewId, sdm);

    const Node = makeSpaceModuleNode(nodeTypes);

    return { pt, as, ss, Node };
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
