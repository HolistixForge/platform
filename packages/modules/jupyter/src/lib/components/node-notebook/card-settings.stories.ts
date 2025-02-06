import type { Meta, StoryObj } from '@storybook/react';

import { CardSettings } from './card-settings';

const meta = {
  title: 'Nodes/Notebook/Asset/CardSettings',
  component: CardSettings,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    status: {
      control: {
        type: 'select',
        options: ['success', 'error', 'warning'],
      },
    },
  },
} satisfies Meta<typeof CardSettings>;

export default meta;

type Story = StoryObj<typeof CardSettings>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-20764&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    status: 'success',
  },
};
