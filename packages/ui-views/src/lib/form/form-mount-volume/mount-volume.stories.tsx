import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@holistix/ui-base';

import { MountVolumeForm, MountVolumeFormData } from './mount-volume';

//

const StoryWrapper = () => {
  const action = useAction<MountVolumeFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="Mount Volume"
      description="Choose a mount point"
      open={true}
      onOpenChange={() => null}
    >
      <MountVolumeForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/MountVolume',
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
