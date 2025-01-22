import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import { TPosition } from '../apis/types/node';
import { TEdgeEnd, TEdge } from '../apis/types/edge';
import { DemiurgeSpace } from '../reactflow-renderer/main';
import { ReactflowPointerTracker } from '../reactflow-renderer/reactflowPointerTracker';
import { HtmlAvatarStore } from '../reactflow-renderer/htmlAvatarStore';

import { FakeSpaceAwareness } from './fakeSpaceAwareness';
import { LocalSpaceActionsDispatcher } from './localSpaceActionsDispatcher';
import { CustomStoryEdge } from './edge';
import { CustomStoryNode } from './node';
import { SpaceState } from '../apis/spaceState';

//

const Demo = () => {
  const logics = useMemo(() => {
    const ga = new FakeSpaceAwareness();
    const pt = new ReactflowPointerTracker(ga);
    const as = new HtmlAvatarStore(pt, ga);
    const ss = new SpaceState();
    const sad = new LocalSpaceActionsDispatcher(ss);

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
        currentUser={{ username: 'toto', color: '#ffa500' }}
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
