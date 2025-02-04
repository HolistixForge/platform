import type { Meta, StoryObj } from '@storybook/react';

import { UserList } from './user-list';

const meta = {
  title: 'Mvp/Components/user-list',
  component: UserList,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    displayTabs: {
      control: {
        type: 'boolean',
      },
    },
    displayEmail: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof UserList>;

export default meta;

type Story = StoryObj<typeof UserList>;

export const Default: Story = {
  args: {
    displayTabs: true,
    displayEmail: true,
  },
};
