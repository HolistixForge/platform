import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { PointerTracker } from '../reactflow-renderer/pointerTracker';
import { FakeSpaceAwareness } from '../reactflow-renderer/spaceAwareness';
import { AvatarStore } from '../reactflow-renderer/avatarStore';
import { DemiurgeSpace } from '../reactflow-renderer/main';
import { TPosition, TEdgeEnd, TEdge } from '@monorepo/demiurge-types';
import { CustomStoryEdge } from './edge';
import { CustomStoryNode } from './node';
import { DummySpaceActionsDispatcher } from '../reactflow-renderer/spaceActionsDispatcher';
import { DummySpaceState } from '../reactflow-renderer/spaceState';
//

//

const Demo = () => {
  const logics = useMemo(() => {
    const ga = new FakeSpaceAwareness();
    const pt = new PointerTracker(ga);
    const as = new AvatarStore(pt, ga);
    const sad = new DummySpaceActionsDispatcher();
    const ss = new DummySpaceState();

    return { ga, pt, as, sad, ss };
  }, []);

  return (
    <DemiurgeSpace
      viewId={''}
      nodeComponent={CustomStoryNode}
      edgeComponent={CustomStoryEdge}
      spaceState={logics.ss}
      spaceActionsDispatcher={logics.sad}
      currentUser={{ username: 'toto', color: '#ffa500' }}
      spaceAwareness={logics.ga}
      pointerTracker={logics.pt}
      avatarsStore={logics.as}
      onContextMenu={function (xy: TPosition, clientPosition: TPosition): void {
        alert('Function not implemented.');
      }}
      onContextMenuNewEdge={function (
        from: TEdgeEnd,
        xy: TPosition,
        clientPosition: TPosition,
      ): void {
        alert('Function not implemented.');
      }}
      onConnect={function (edge: TEdge): void {
        alert('Function not implemented.');
      }}
    />
  );
};

//

const meta = {
  title: 'Space/Demo',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof Demo>;

export const Normal: Story = {
  args: {},
};
