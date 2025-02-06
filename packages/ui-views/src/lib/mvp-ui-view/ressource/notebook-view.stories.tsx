import type { Meta, StoryObj } from '@storybook/react';

import { NotebookView } from './notebook-view';

const meta = {
  title: 'Mvp/Resource/Notebook/notebook-view',
  component: NotebookView,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof NotebookView>;

export default meta;

type Story = StoryObj<typeof NotebookView>;

export const Stop: Story = {
  args: { status: 'stopped' },
};

export const Load: Story = {
  args: { status: 'loading' },
};

export const Running: Story = {
  args: { status: 'running' },
};

export const Host: Story = {
  args: { status: 'hosted' },
};
