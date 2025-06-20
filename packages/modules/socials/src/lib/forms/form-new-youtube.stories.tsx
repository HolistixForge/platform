import type { Meta, StoryObj } from '@storybook/react';

import { NewYoutubeForm } from './form-new-youtube';
import { MockCollaborativeContext } from '@monorepo/collab-engine';

//

const StoryWrapper = () => {
  return (
    <MockCollaborativeContext
      frontChunks={[]}
      backChunks={[]}
      getRequestContext={() => ({})}
    >
      <NewYoutubeForm
        viewId={''}
        position={{ x: 0, y: 0 }}
        closeForm={() => {}}
      />
    </MockCollaborativeContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Forms/NewYoutube',
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
