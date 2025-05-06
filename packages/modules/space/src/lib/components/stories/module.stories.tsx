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
import { Core_loadData, CoreReducer } from '@monorepo/core';

import { SpaceModule } from '../collab-module/main';
import { SpaceReducer } from '../../space-reducer';
import { Space_loadData } from '../../space-shared-model';
import { Group } from '../group/group';
import { loadStoryData, STORY_VIEW_ID } from './graphs-data/loader';
//

Logger.setPriority(7);

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

const nodeTypes = {
  group: Group,
};

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher();
  }, []);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
        simulateUsers: true,
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <div style={{ height: '100vh', width: '100vw' }}>
        <SpaceModule viewId={STORY_VIEW_ID} nodeTypes={nodeTypes} />
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
