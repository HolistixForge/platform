import type { Meta, StoryObj } from '@storybook/react';
import { TotpFieldset } from './totp-fieldset';
import { useState } from 'react';

//

const StoryWrapper = () => {
  const [value, setValue] = useState('456');
  const onChange = (v: string) => {
    console.log(v);
    setValue(v);
  };
  return <TotpFieldset label="Totp" value={value} onChange={onChange} />;
};

//

const meta = {
  title: 'Forms/Fields/Totp',
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
