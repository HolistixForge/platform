import { useMemo } from 'react';

import { TPosition, TEdgeEnd, TEdge } from '@monorepo/core';

import { DemiurgeSpace } from '../reactflow-renderer/main';
import { ReactflowPointerTracker } from '../reactflow-renderer/reactflowPointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { CustomStoryEdge } from '../local-test/edge';
import { CustomStoryNode } from '../local-test/node';

import { CollabSpaceState } from './collab-space-state';
import { CollabSpaceAwareness } from './collab-space-awareness';
import { CollabSpaceActionsDispatcher } from './collab-space-actions-dispatcher';

//

export const SpaceModule = () => {
  const logics = useMemo(() => {
    const ga = new CollabSpaceAwareness();
    const pt = new ReactflowPointerTracker(ga);
    const as = new HtmlAvatarStore(pt, ga);
    const ss = new CollabSpaceState();
    const sad = new CollabSpaceActionsDispatcher();

    return { ga, pt, as, sad, ss };
  }, []);

  return (
    <div style={{ height: '100vh' }}>
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
        onContextMenu={function (
          xy: TPosition,
          clientPosition: TPosition
        ): void {
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
    </div>
  );
};
