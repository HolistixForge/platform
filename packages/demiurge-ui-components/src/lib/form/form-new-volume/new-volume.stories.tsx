import type { Meta, StoryObj } from '@storybook/react';
import { NewVolumeForm, NewVolumeFormData } from './new-volume';
import { useAction } from '../../buttons/useAction';
import { DialogControlled } from '../../dialog/dialog';

//

const StoryWrapper = () => {
  const action = useAction<NewVolumeFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="New Volume"
      description="Choose a name and storage capacity for your new volume."
      open={true}
      onOpenChange={() => null}
    >
      <NewVolumeForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewVolume',
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
