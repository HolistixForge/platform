import type { Meta, StoryObj } from '@storybook/react';

import { UserDisplay } from './user-display';

const meta = {
  title: 'Mvp/Assets/user-display',
  component: UserDisplay,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof UserDisplay>;

export default meta;

type Story = StoryObj<typeof UserDisplay>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const Default: Story = {
  args: {},
};