import type { Meta, StoryObj } from '@storybook/react';

import { SummaryAccesses } from './summary-accesses';

const meta = {
  title: 'Mvp/Components/summary-accesses',
  component: SummaryAccesses,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    activeTab: {
      control: {
        type: 'select',
      },
    },
  },
} satisfies Meta<typeof SummaryAccesses>;

export default meta;

type Story = StoryObj<typeof SummaryAccesses>;

export const Users: Story = {
  args: {
    activeTab: 'users',
  },
};
export const Groups: Story = {
  args: {
    activeTab: 'groups',
  },
};
export const Roles: Story = {
  args: {
    activeTab: 'roles',
  },
};
