import type { Meta, StoryObj } from '@storybook/react';
import { MockCollaborativeContext } from '@monorepo/collab-engine';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';
import { StoryApiContext } from '@monorepo/frontend-data';
import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';
import { moduleBackend as notionBackend } from '../..';
import { moduleFrontend as notionFrontend } from '../../frontend';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { StoryHolistixSpace } from '@monorepo/space/stories';
import type { ModuleBackend } from '@monorepo/module';

//

const modulesBackend: ModuleBackend[] = [
  { collabChunk: { name: 'gateway' } },
  coreBackend,
  spaceBackend,
  {
    collabChunk: {
      name: 'config',
      loadExtraContext: () => ({ config: { NOTION_API_KEY: 'secret_123' } }),
    },
  },
  notionBackend,
];

const modulesFrontend = [coreFrontend, spaceFrontend, notionFrontend];

//

const nodeTypes = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

//

const spaceMenuEntries: TSpaceMenuEntries = (args) => {
  return modulesFrontend.reduce((acc, module) => {
    return [...acc, ...module.spaceMenuEntries(args)];
  }, [] as TSpaceMenuEntry[]);
};

//

const Story = () => {
  //

  return (
    <StoryApiContext>
      <MockCollaborativeContext
        frontChunks={modulesFrontend.map((m) => m.collabChunk)}
        backChunks={modulesBackend.map((m) => m.collabChunk)}
        getRequestContext={() => ({})}
      >
        <div style={{ height: '100vh', width: '100vw' }}>
          <StoryHolistixSpace
            nodeTypes={nodeTypes}
            spaceMenuEntries={spaceMenuEntries}
          />
        </div>
      </MockCollaborativeContext>
    </StoryApiContext>
  );
};

//

//

const meta = {
  title: 'Modules/Notion/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

type Story = StoryObj<typeof Story>;

export const Default: Story = {
  args: {},
};
