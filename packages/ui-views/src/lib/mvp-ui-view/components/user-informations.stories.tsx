import type { Meta, StoryObj } from '@storybook/react';

import { UserInformations } from './user-informations';

//

const meta = {
  title: 'Mvp/Components/user-informations',
  component: UserInformations,
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
} satisfies Meta<typeof UserInformations>;

export default meta;

type Story = StoryObj<typeof UserInformations>;

export const Default: Story = {
  args: {
    editing: false,
  },
};
export const Edition: Story = {
  args: {
    editing: true,
  },
};
