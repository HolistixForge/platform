import type { Meta, StoryObj } from '@storybook/react';

import { UserView } from './user-view';

const meta = {
  title: 'Mvp/View/user-view',
  component: UserView,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    editingUser: { control: 'boolean' },
  },
} satisfies Meta<typeof UserView>;

export default meta;

type Story = StoryObj<typeof UserView>;

export const Normal: Story = {
  args: {
    editingUser: false,
  },
};

export const Editing: Story = {
  args: {
    editingUser: true,
  },
};
