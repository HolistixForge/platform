import type { Meta, StoryObj } from '@storybook/react';
import { useAction } from '../../buttons/useAction';
import { TotpLoginForm, TotpLoginFormData } from './totp';

//

const StoryWrapper = () => {
  const action = useAction<TotpLoginFormData>((d) => {
    console.log(d);
    return Promise.resolve();
  }, []);
  return <TotpLoginForm action={action} />;
};

//

const meta = {
  title: 'Forms/Account/TotpLogin',
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
