import type { Meta, StoryObj } from '@storybook/react';

import { UserDisplayItem } from './user-display-item';
import { randomGuy } from '../../utils/random-guys';

const meta = {
  title: 'Mvp/Assets/user-display-item',
  component: UserDisplayItem,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    mail: {
      control: {
        type: 'text',
      },
    },
    role: {
      control: {
        type: 'text',
      },
    },
    roleColor: {
      control: {
        type: 'color',
      },
    },
    buttons: {
      control: {
        type: 'object',
      },
    },
  },
} satisfies Meta<typeof UserDisplayItem>;

export default meta;

type Story = StoryObj<typeof UserDisplayItem>;

export const Default: Story = {
  args: {
    mail: 'chrys.beltran@outlook.fr',
    user: randomGuy(),
    role: 'role',
    roleColor: '#bf8e2d',
    buttons: {
      settings: true,
      remove: true,
      filter: true,
      delete: true,
    },
  },
};
