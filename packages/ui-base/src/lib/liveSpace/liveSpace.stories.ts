import type { Meta, StoryObj } from '@storybook/react';
import { createElement } from 'react';

import { LiveSpace } from './liveSpace';

const meta: Meta<typeof LiveSpace> = {
  title: 'Base/Components/LiveSpace',
  component: LiveSpace,
  decorators: [
    (Story) =>
      createElement(
        'div',
        { style: { padding: '60px 50px' } },
        createElement(Story)
      ),
  ],
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
    color: 'var(--green-400)',
    status: 'default',
  },
};
