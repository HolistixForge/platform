import type { Meta, StoryObj } from '@storybook/react';
import { AccessRole } from './access-role';

const meta = {
  title: 'Mvp/View/access-role',
  component: AccessRole,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof AccessRole>;

export default meta;

type Story = StoryObj<typeof AccessRole>;

export const Normal: Story = {
  args: {},
};
