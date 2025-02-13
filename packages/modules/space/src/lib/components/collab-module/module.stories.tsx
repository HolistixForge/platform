import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import {
  CollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  Dispatcher,
} from '@monorepo/collab-engine';
import { Logger } from '@monorepo/log';

import { SpaceModule } from './main';
import { SpaceReducer } from '../../space-reducer';
import { Space_loadData, TSpaceSharedData } from '../../space-shared-model';
import { defaultGraphView, TGraphView } from '../../space-types';
import { graph1 } from '../local-test/graphs-data/graph-1';

//

Logger.setPriority(7);

//

const loadStoryData = (sd: TSpaceSharedData) => {
  const graphViews = sd.graphViews;
  const gv: TGraphView = defaultGraphView();
  gv.edges = graph1.edges;
  gv.nodeViews = graph1.nodeViews;
  graphViews.set('graph-1', gv);
};

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => {
      const sd = Space_loadData(st);
      loadStoryData(sd);
      return sd;
    },
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
  },
];

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher({});
  }, []);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <SpaceModule viewId={'graph-1'} />
    </CollaborativeContext>
  );
};

//

const meta = {
  title: 'Modules/Space/Main',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
