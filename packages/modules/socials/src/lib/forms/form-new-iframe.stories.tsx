import type { Meta, StoryObj } from '@storybook/react';

import { NewIframeForm } from './form-new-iframe';
import { MockCollaborativeContext } from '@monorepo/collab-engine';

//

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext
      frontChunks={[]}
      backChunks={[]}
      getRequestContext={() => ({})}
    >
      <NewIframeForm
        viewId={''}
        position={{ x: 0, y: 0 }}
        closeForm={() => {}}
      />
    </MockCollaborativeContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Forms/NewIframe',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  args: {},
};
