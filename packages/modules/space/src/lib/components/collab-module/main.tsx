import { useMemo } from 'react';

import { TPosition, TEdgeEnd, TEdge } from '@monorepo/core';
import {
  useDispatcher,
  useAwareness,
  useSharedData,
} from '@monorepo/collab-engine';

import { DemiurgeSpace } from '../reactflow-renderer/main';
import { ReactflowPointerTracker } from '../reactflow-renderer/reactflowPointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { CustomStoryEdge } from '../local-test/edge';
import { CustomStoryNode } from '../local-test/node';

import { CollabSpaceState } from './collab-space-state';
import { CollabSpaceAwareness } from './collab-space-awareness';
import { CollabSpaceActionsDispatcher } from './collab-space-actions-dispatcher';

//

export const SpaceModule = ({ viewId }: { viewId: string }) => {
  const sd = useSharedData(['graphViews'], (sd) => sd);
  const collabDispatcher = useDispatcher();
  const { awareness } = useAwareness();

  const logics = useMemo(() => {
    const ga = new CollabSpaceAwareness(viewId, awareness);
    const pt = new ReactflowPointerTracker(ga);
    const as = new HtmlAvatarStore(pt, ga);
    const ss = new CollabSpaceState(viewId, sd);
    const sad = new CollabSpaceActionsDispatcher(viewId, collabDispatcher);

    return { ga, pt, as, sad, ss };
  }, []);

  return (
    <DemiurgeSpace
      viewId={'view-story'}
      nodeComponent={CustomStoryNode}
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
