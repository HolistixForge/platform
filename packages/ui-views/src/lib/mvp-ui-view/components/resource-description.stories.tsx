import type { Meta, StoryObj } from '@storybook/react';

import { ResourceDescription } from './resource-description';

//

const meta = {
  title: 'Mvp/Components/resource-description',
  component: ResourceDescription,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    editing: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof ResourceDescription>;

export default meta;

type Story = StoryObj<typeof ResourceDescription>;

export const Default: Story = {
  args: {
    editing: false,
  },
};
export const Editing: Story = {
  args: {
    editing: true,
  },
};
