import type { Meta, StoryObj } from '@storybook/react';

import { LiveSpace } from './liveSpace';

const meta: Meta<typeof LiveSpace> = {
  title: 'UI/LiveSpace',
  component: LiveSpace,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: 'color',
    },
    status: {
      control: {
        type: 'select',
        options: ['default', 'resolved', 'new'],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof LiveSpace>;

export const Normal: Story = {
  args: {
    color: 'var(--c-green-1)',
    status: 'default',
  },
};
