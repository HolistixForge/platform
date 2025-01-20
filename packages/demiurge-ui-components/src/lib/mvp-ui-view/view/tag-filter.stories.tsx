import type { Meta, StoryObj } from '@storybook/react';

import { TagFilter } from './tag-filter';

const meta = {
  title: 'Mvp/View/tag-filter',
  component: TagFilter,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof TagFilter>;

export default meta;

type Story = StoryObj<typeof TagFilter>;

export const Normal: Story = {
  args: {},
};
