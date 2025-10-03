import type { Meta, StoryObj } from '@storybook/react';

import { MockCollaborativeContext } from '@monorepo/collab-engine';

import { NewVolumeForm } from './new-volume';

//

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext
      frontChunks={[]}
      backChunks={[]}
      getRequestContext={() => ({})}
    >
      <NewVolumeForm
        viewId={''}
        position={{ x: 0, y: 0 }}
        closeForm={() => null}
      />
    </MockCollaborativeContext>
  );
};

//

const meta = {
  title: 'Modules/Servers/Forms/NewVolume',
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
