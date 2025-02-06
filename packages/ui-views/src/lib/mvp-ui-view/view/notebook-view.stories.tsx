import type { Meta, StoryObj } from '@storybook/react';

import { NotebookView } from './notebook-view';

const meta = {
  title: 'Mvp/View/notebook-view',
  component: NotebookView,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    updateDescription: { control: 'boolean' },
  },
} satisfies Meta<typeof NotebookView>;

export default meta;

type Story = StoryObj<typeof NotebookView>;

export const Normal: Story = {
  args: {
    updateDescription: false,
  },
};

export const UpdateDescription: Story = {
  args: {
    updateDescription: true,
  },
};
