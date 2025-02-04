import type { Meta, StoryObj } from '@storybook/react';

import { ResourceSelection } from './resource-selection';

const meta = {
  title: 'Mvp/Assets/resource-selection',
  component: ResourceSelection,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
      defaultValue: false,
    },
  },
} satisfies Meta<typeof ResourceSelection>;

export default meta;

type Story = StoryObj<typeof ResourceSelection>;

export const Open: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?node-id=815-4045&t=YdpKlaWKVYRF1JOV-4',
    },
  },
  args: {
    isOpen: true,
  },
};
export const Closed: Story = {
  args: {
    isOpen: false,
  },
};
