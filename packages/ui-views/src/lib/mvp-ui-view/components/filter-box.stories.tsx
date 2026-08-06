import type { Meta, StoryObj } from '@storybook/react';

import { FilterBox } from './filter-box';

//

const meta = {
  title: 'Mvp/Components/FilterBox',
  component: FilterBox,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    mode: {
      options: ['Group', 'Role'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof FilterBox>;

export default meta;

type Story = StoryObj<typeof FilterBox>;

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
