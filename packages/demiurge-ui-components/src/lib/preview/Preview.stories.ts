import type { Meta, StoryObj } from '@storybook/react';

import { Preview } from './Preview';

const meta = {
  title: 'UI/Preview',
  component: Preview,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof Preview>;

export default meta;

type Story = StoryObj<typeof Preview>;

export const Normal: Story = {
  args: {},
};
