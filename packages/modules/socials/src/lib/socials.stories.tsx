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

import {
  SpaceModule,
  SpaceReducer,
  Space_loadData,
  TSpaceSharedData,
  defaultGraphView,
} from '@monorepo/space';
import { NodeTextEditor, NodeYoutube } from '../frontend';

//

Logger.setPriority(7);

//

const loadStoryData = (sd: TSpaceSharedData & TCoreSharedData) => {
  const graphViews = sd.graphViews;
  const gv = defaultGraphView();

  sd.nodes.set('node-1', {
    id: 'node-1',
    type: 'youtube',
    data: {
      youtubeId: 'P8JEm4d6Wu4',
    },
    name: 'Node 1',
    root: true,
    connectors: [],
  });

  sd.nodes.set('node-2', {
    id: 'node-2',
    type: 'text-editor',
    data: {},
    name: 'Node 2',
    root: true,
    connectors: [],
  });

  gv.graph.nodes.push({
    id: 'node-2',
    type: 'text-editor',
    position: {
      x: 0,
      y: 0,
    },
    size: {
      width: 400,
      height: 300,
    },
    status: {
      mode: 'EXPANDED',
      forceOpened: true,
      forceClosed: false,
      isFiltered: false,
      rank: 0,
      maxRank: 0,
    },
  });

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

const nodeTypes = {
  youtube: NodeYoutube,
  'text-editor': NodeTextEditor,
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
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <div style={{ height: '100vh', width: '100vw' }}>
        <SpaceModule viewId={'graph-1'} nodeTypes={nodeTypes} />
      </div>
    </CollaborativeContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Main',
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
