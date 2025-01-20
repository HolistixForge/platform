import type { Meta, StoryObj } from '@storybook/react';

import { Warning } from './warning';

const meta = {
  title: 'Mvp/Assets/warning',
  component: Warning,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      options: ['resource-bar', 'server-card', 'notebook-card'],
      control: { type: 'radio' },
    },
    color: {
      control: { type: 'radio' },
      options: ['green', 'red', 'yellow', 'blue'],
    },
  },
} satisfies Meta<typeof Warning>;

export default meta;

type Story = StoryObj<typeof Warning>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const ResourceBar: Story = {
  args: {
    type: 'resource-bar',
    color: 'green',
  },
};
export const ServerCard: Story = {
  args: {
    type: 'server-card',
    color: 'green'
  },
};
export const NotebookCard: Story = {
  args: {
    type: 'notebook-card',
    color: 'green'
  },
};
