import type { Meta, StoryObj } from '@storybook/react';

import { StatusLed } from './status-led';

const meta = {
  title: 'Modules/UserContainers/Components/Led',
  component: StatusLed,
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
} satisfies Meta<typeof StatusLed>;

export default meta;

type Story = StoryObj<typeof StatusLed>;

export const ResourceBar: Story = {
  args: {
    type: 'resource-bar',
    color: 'green',
  },
};
export const ServerCard: Story = {
  args: {
    type: 'server-card',
    color: 'green',
  },
};
export const NotebookCard: Story = {
  args: {
    type: 'notebook-card',
    color: 'green',
  },
};
