import type { Meta, StoryObj } from '@storybook/react';

import { ServerView } from './server-view';

const meta = {
  title: 'Mvp/View/server-view',
  component: ServerView,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof ServerView>;

export default meta;

type Story = StoryObj<typeof ServerView>;

export const Normal: Story = {
  args: {},
};
