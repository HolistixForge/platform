import type { Meta, StoryObj } from '@storybook/react';

import { Cursor } from './Cursor';

const meta = {
  title: 'Modules/Space/Components/Cursor',
  component: Cursor,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    fill: {
      control: {
        type: 'radio',
      },
      defaultValue: 'transparent',
      options: ['transparent', 'color'],
    },
    color: {
      controls: {
        type: 'color',
      },
    },
    username: {
      control: {
        type: 'select',
      },
      options: ['Manager', 'Founder', 'CEO', 'Developper'],
    },
  },
} satisfies Meta<typeof Cursor>;

export default meta;

type Story = StoryObj<typeof Cursor>;

export const Normal: Story = {
  args: {
    fill: 'color',
    username: 'github:JohnManager',
    firstname: 'John',
    lastname: 'Manager',
    color: 'var(--c-pink-3)',
  },
};
