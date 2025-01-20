import type { Meta, StoryObj } from '@storybook/react';
import {
  TotpSetupForm,
  TotpEnableFormData,
  TotpLoginFormData,
  TotpSetupFormProps,
} from './totp';
import { useAction } from '../../buttons/useAction';

//

const StoryWrapper = (props: TotpSetupFormProps & { enabled: boolean }) => {
  const actionEnable = useAction<TotpEnableFormData>(
    (d) => {
      console.log(d);
      return Promise.resolve();
    },
    [],
    { values: { enabled: props.enabled } },
  );

  const actionLogin = useAction<TotpLoginFormData>(
    (d) => {
      console.log(d);
      return Promise.resolve();
    },
    [],
    { values: { code: '' } },
  );

  return (
    <TotpSetupForm
      {...props}
      actionEnable={actionEnable}
      actionLogin={actionLogin}
      qrcodeUrl="https://www.youtube.com/watch?v=y6120QOlsfU"
      keyValue="2fc6e27701b4cae015ff41e00c97abde3628eef58556f3f6a71392d84aa4ed13a5ebf98ef7872082848ab09e48f5a7d45e77"
    />
  );
};

//

const meta = {
  title: 'Forms/Account/Totp',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Active: Story = {
  args: {
    enabled: true,
  },
};

export const Inactive: Story = {
  args: {
    enabled: false,
    showKey: true,
  },
};
