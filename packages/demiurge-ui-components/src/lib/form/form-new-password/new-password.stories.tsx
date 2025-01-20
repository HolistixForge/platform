import type { Meta, StoryObj } from '@storybook/react';
import { useAction } from '../../buttons/useAction';
import { NewPasswordForm } from './new-password';

//

const StoryWrapper = () => {
  const action = useAction<{ password: string }>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return <NewPasswordForm action={action} />;
};

//

const meta = {
  title: 'Forms/Account/NewPassword',
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
