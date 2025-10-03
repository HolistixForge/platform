import type { Meta, StoryObj } from '@storybook/react';

import { useAction, DialogControlled } from '@monorepo/ui-base';

import {
  CloudInstanceOptionsForm,
  CloudInstanceOptionsFormData,
} from './cloud-instance-options';
//

const StoryWrapper = () => {
  const action = useAction<CloudInstanceOptionsFormData>(
    async (d) => {
      console.log(d);
      const e = new Error('');
      (e as any).json = {
        errors: {
          instanceType: 'Not available',
        },
      };
      throw e;
    },
    [],
    {
      values: { instanceType: 't2.small', storage: 10 },
    }
  );
  return (
    <DialogControlled
      title="Cloud Options"
      description="select cloud hosting options"
      open={true}
      onOpenChange={() => null}
    >
      <CloudInstanceOptionsForm action={action} />
    </DialogControlled>
  );
};

//

const meta = {
  title: 'Modules/Servers/Forms/Cloud Instance Options',
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
