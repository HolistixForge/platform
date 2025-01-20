import type { Meta, StoryObj } from '@storybook/react';
import { LoginForm, LoginFormData } from './login';
import { useAction } from '../../buttons/useAction';

//

const StoryWrapper = () => {
  const action = useAction<LoginFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return <LoginForm action={action} gitLabLoginUrl="" githubLoginUrl="" />;
};

//

const meta = {
  title: 'Forms/Account/Login',
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
