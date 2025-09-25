import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { MockCollaborativeContext } from '@monorepo/collab-engine';
import { StoryApiContext } from '@monorepo/frontend-data';
import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';
import type { ModuleBackend } from '@monorepo/module';

import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';

import { moduleBackend as excalidrawBackend } from '../..';
import { moduleFrontend as excalidrawFrontend } from '../../frontend';
import { StoryHolistixSpace } from '@monorepo/space/stories';

Logger.setPriority(7);

const modulesBackend: ModuleBackend[] = [
  { collabChunk: { name: 'gateway' } },
  coreBackend,
  spaceBackend,
  excalidrawBackend,
];

const modulesFrontend = [coreFrontend, spaceFrontend, excalidrawFrontend];

const nodeTypes = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

const spaceMenuEntries: TSpaceMenuEntries = (args) => {
  return modulesFrontend.reduce((acc, module) => {
    return [...acc, ...module.spaceMenuEntries(args)];
  }, [] as TSpaceMenuEntry[]);
};

const panelsDefs = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.panels };
}, {} as Record<string, any>);

const layersProviders = modulesFrontend.flatMap((m) => m.layers || []);

const Story = () => {
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
            panelsDefs={panelsDefs}
            layersProviders={layersProviders}
          />
        </div>
      </MockCollaborativeContext>
    </StoryApiContext>
  );
};

const meta = {
  title: 'Modules/Excalidraw/Main',
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
