import type { Meta, StoryObj } from '@storybook/react';

import { useAction } from '@monorepo/demiurge-ui-components';

import { SendMagicLinkForm, SendMagicLinkFormProps } from './login';

//

const StoryWrapper = (
  props: Pick<SendMagicLinkFormProps, 'showForm' | 'title'>
) => {
  const action = useAction<{ email: string }>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return <SendMagicLinkForm action={action} {...props} />;
};

//

const meta = {
  title: 'Forms/Account/MagicLink',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const ResetPassword: Story = {
  args: {
    showForm: true,
    title: 'Reset Password',
  },
};

export const ValidateEmail: Story = {
  args: {
    showForm: false,
    title: 'Validate email address',
  },
};
