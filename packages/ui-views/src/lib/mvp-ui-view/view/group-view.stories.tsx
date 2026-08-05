import type { Meta, StoryObj } from '@storybook/react';

import { GroupView } from './group-view';

const meta = {
  title: 'Mvp/View/group-view',
  component: GroupView,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof GroupView>;

export default meta;

type Story = StoryObj<typeof GroupView>;

export const Normal: Story = {
  args: {},
};
