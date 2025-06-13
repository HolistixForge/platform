import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { StorySpace } from '@monorepo/space/frontend';
import { StoryApiContext } from '@monorepo/frontend-data';
import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';

import {
  JupyterStoryCollabContext,
  modulesFrontend,
} from './module-stories-utils';

//

Logger.setPriority(7);

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

const StoryWrapper = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <StoryApiContext>
        <JupyterStoryCollabContext>
          <StorySpace
            nodeTypes={nodeTypes}
            spaceMenuEntries={spaceMenuEntries}
          />
        </JupyterStoryCollabContext>
      </StoryApiContext>
    </div>
  );
};

//

const meta = {
  title: 'Modules/Jupyter/Main',
  component: StoryWrapper,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
