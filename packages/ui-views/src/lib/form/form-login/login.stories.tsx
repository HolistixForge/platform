import type { Meta, StoryObj } from '@storybook/react';

import { useAction } from '@monorepo/demiurge-ui-components';
import { LoginFormData } from '@monorepo/frontend-data';

import { LoginForm } from './login';

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
