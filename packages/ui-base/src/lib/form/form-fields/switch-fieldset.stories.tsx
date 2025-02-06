import type { Meta, StoryObj } from '@storybook/react';
import { SwitchFieldset } from './switch-fieldset';

//

//

const meta = {
  title: 'Forms/Fields/Switch',
  component: SwitchFieldset,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof SwitchFieldset>;

export default meta;

type Story = StoryObj<typeof SwitchFieldset>;

export const Inactive: Story = {
  args: {
    value: false,
    onChange: (v: boolean) => console.log(v),
    label: 'Label',
    name: 'name',
  },
};

export const Active: Story = {
  args: {
    value: true,
    onChange: (v: boolean) => console.log(v),
    label: 'Resolved',
    name: 'name',
  },
};
