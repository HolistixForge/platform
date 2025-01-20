import type { Meta, StoryObj } from '@storybook/react';

import { Rules } from './rules';

const meta = {
  title: 'Mvp/Components/rules',
  component: Rules,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
  },
} satisfies Meta<typeof Rules>;

export default meta;

type Story = StoryObj<typeof Rules>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const Group: Story = {
  args: {
    mode: 'Group',
  },
};
export const Role: Story = {
  args: {
    mode: 'Role',
  },
};
