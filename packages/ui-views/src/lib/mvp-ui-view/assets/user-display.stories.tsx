import type { Meta, StoryObj } from '@storybook/react';

import { UserDisplay } from './user-display';

const meta = {
  title: 'Mvp/Assets/UserDisplay',
  component: UserDisplay,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof UserDisplay>;

export default meta;

type Story = StoryObj<typeof UserDisplay>;

export const Default: Story = {
  args: {},
};
