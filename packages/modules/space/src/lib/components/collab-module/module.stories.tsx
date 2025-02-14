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
import { Core_loadData, CoreReducer, TCoreSharedData } from '@monorepo/core';

import { SpaceModule } from './main';
import { SpaceReducer } from '../../space-reducer';
import { Space_loadData, TSpaceSharedData } from '../../space-shared-model';
import { defaultGraphView, TGraphView } from '../../space-types';
import { loadStoryGraph } from '../local-test/localSpaceActionsDispatcher';

//

Logger.setPriority(7);

//

const loadStoryData = (sd: TSpaceSharedData & TCoreSharedData) => {
  const graphViews = sd.graphViews;
  const gv: TGraphView = defaultGraphView();

  loadStoryGraph(gv, sd.nodes as any);

  graphViews.set('graph-1', gv);
};

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Core_loadData(st),
    reducers: (sd: TValidSharedData) => [new CoreReducer()],
  },
  {
    sharedData: (st: SharedTypes) => {
      const sd = Space_loadData(st);

      return sd;
    },
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
    extraContext: (sd: TValidSharedData) => {
      loadStoryData(sd as any);
      return {};
    },
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
      <div style={{ height: '100vh', width: '100vw' }}>
        <SpaceModule viewId={'graph-1'} />
      </div>
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
