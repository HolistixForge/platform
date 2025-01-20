import type { Meta, StoryObj } from '@storybook/react';

import { Accesses } from './accesses';

const meta = {
  title: 'Mvp/View/accesses',
  component: Accesses,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof Accesses>;

export default meta;

type Story = StoryObj<typeof Accesses>;

export const Normal: Story = {
  args: {},
};
