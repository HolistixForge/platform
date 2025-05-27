import type { Meta, StoryObj } from '@storybook/react';

import {
  MockCollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
} from '@monorepo/collab-engine';
import { Logger } from '@monorepo/log';
import { Core_loadData, CoreReducer, TCoreSharedData } from '@monorepo/core';
import {
  SpaceReducer,
  Space_loadData,
  TSpaceSharedData,
  defaultGraphView,
} from '@monorepo/space';
import { SpaceModule } from '@monorepo/space/frontend';

import { NodeIframe, NodeTextEditor, NodeYoutube } from '../frontend';

//

Logger.setPriority(7);

//

const STORY_VIEW_ID = 'story';

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

  sd.nodes.set('node-3', {
    id: 'node-3',
    type: 'iframe',
    data: {
      src: 'https://www.holistix.so',
    },
    name: 'Node 3',
    root: true,
    connectors: [],
  });

  //

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

  gv.graph.nodes.push({
    id: 'node-1',
    type: 'youtube',
    position: {
      x: 500,
      y: 500,
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

  gv.graph.nodes.push({
    id: 'node-3',
    type: 'iframe',
    position: {
      x: -100,
      y: 600,
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

  graphViews.set(STORY_VIEW_ID, gv);
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
  iframe: NodeIframe,
};

//

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext collabChunks={chunks}>
      <div style={{ height: '100vh', width: '100vw' }}>
        <SpaceModule viewId={STORY_VIEW_ID} nodeTypes={nodeTypes} />
      </div>
    </MockCollaborativeContext>
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
