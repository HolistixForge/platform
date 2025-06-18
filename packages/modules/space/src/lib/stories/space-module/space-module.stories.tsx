import type { Meta, StoryObj } from '@storybook/react';

import { MockCollaborativeContext } from '@monorepo/collab-engine';
import { Logger } from '@monorepo/log';

import { HolistixSpace } from '../../components/holistix-space';
import { Group } from '../../components/group/group';
import { STORY_VIEW_ID } from '../story-holistix-space';
import { loadStoryData } from './loader';

import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';
import { moduleBackend as spaceBackend } from '../../..';
import { moduleFrontend as spaceFrontend } from '../../../frontend';

//

Logger.setPriority(7);

const modulesBackend = [
  { collabChunk: { name: 'gateway' } },
  coreBackend,
  spaceBackend,
];

const modulesFrontend = [coreFrontend, spaceFrontend];

//

const nodeTypes = {
  group: Group,
};

//

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext
      frontChunks={modulesFrontend.map((m) => m.collabChunk)}
      backChunks={modulesBackend.map((m) => m.collabChunk)}
      getRequestContext={(e) => {
        console.log('getRequestContext', e);
        return {};
      }}
      callback={({ sharedData, sharedTypes }) => {
        sharedTypes.transaction(async () => {
          console.log('callback', sharedData);
          loadStoryData(sharedData as any);
        });
      }}
    >
      <div style={{ height: '100vh', width: '100vw' }}>
        <HolistixSpace
          viewId={STORY_VIEW_ID}
          nodeTypes={nodeTypes}
          spaceMenuEntries={() => []}
        />
      </div>
    </MockCollaborativeContext>
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
