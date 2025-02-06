import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@monorepo/ui-base';

import { NewKernelForm, NewKernelFormData } from './new-kernel';

//

const StoryWrapper = () => {
  const action = useAction<NewKernelFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return (
    <DialogControlled
      title="New Kernel"
      description="Choose a name for the new kernel."
      open={true}
      onOpenChange={() => null}
    >
      <NewKernelForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Forms/NewKernel',
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
