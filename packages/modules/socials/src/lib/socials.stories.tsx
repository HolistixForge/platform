import type { Meta, StoryObj } from '@storybook/react';

import {
  MockCollaborativeContext,
  TCollaborativeChunk,
  SharedTypes,
} from '@monorepo/collab-engine';
import { Logger } from '@monorepo/log';
import { TCoreSharedData } from '@monorepo/core';
import { TSpaceSharedData, defaultGraphView } from '@monorepo/space';
import { STORY_VIEW_ID } from '@monorepo/space/stories';
import { HolistixSpace } from '@monorepo/space/frontend';
import {
  ModuleFrontend,
  TSpaceMenuEntries,
  TSpaceMenuEntry,
} from '@monorepo/module/frontend';
import { ModuleBackend } from '@monorepo/module';

import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { moduleBackend as socialsBackend } from '../';
import { moduleFrontend as socialsFrontend } from '../frontend';

//

Logger.setPriority(7);

const modulesBackend: ModuleBackend[] = [
  {
    collabChunk: {
      name: 'gateway',
    },
  },
  coreBackend,
  spaceBackend,
  socialsBackend,
];
const modulesFrontend: ModuleFrontend[] = [
  coreFrontend,
  spaceFrontend,
  socialsFrontend,
];

//

const loadStoryData = (
  sd: TSpaceSharedData & TCoreSharedData,
  sharedTypes: SharedTypes
) => {
  sharedTypes.transaction(async () => {
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
  });
};

//

const nodeTypes = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

const spaceMenuEntries: TSpaceMenuEntries = (args) => {
  return modulesFrontend.reduce((acc, module) => {
    return [...acc, ...module.spaceMenuEntries(args)];
  }, [] as TSpaceMenuEntry[]);
};

const frontChunks: TCollaborativeChunk[] = modulesFrontend.map(
  (module) => module.collabChunk
);
const backChunks: TCollaborativeChunk[] = modulesBackend.map(
  (module) => module.collabChunk
);

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext
      frontChunks={frontChunks}
      backChunks={backChunks}
      getRequestContext={() => ({})}
      callback={({ sharedData, sharedTypes }) => {
        loadStoryData(
          sharedData as TSpaceSharedData & TCoreSharedData,
          sharedTypes
        );
      }}
    >
      <div style={{ height: '100vh', width: '100vw' }}>
        <HolistixSpace
          viewId={STORY_VIEW_ID}
          nodeTypes={nodeTypes}
          spaceMenuEntries={spaceMenuEntries}
        />
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
