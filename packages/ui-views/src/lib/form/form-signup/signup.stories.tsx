import type { Meta, StoryObj } from '@storybook/react';
import { SignupForm, SignupFormData } from './signup';
import { useAction } from '../../buttons/useAction';

//

const StoryWrapper = () => {
  const action = useAction<SignupFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return <SignupForm action={action} />;
};

//

const meta = {
  title: 'Forms/Account/Signup',
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
