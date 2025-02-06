import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@monorepo/ui-base';

import { NewYoutubeForm, NewYoutubeFormData } from './new-youtube';

//

const StoryWrapper = () => {
  const action = useAction<NewYoutubeFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="New Youtube video"
      description="Paste the video's id"
      open={true}
      onOpenChange={() => null}
    >
      <NewYoutubeForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewYoutube',
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
