import type { Meta, StoryObj } from '@storybook/react';

import {ResourceList} from './resource-list';

const meta = {
  title: 'Mvp/Components/reource-list',
  component: ResourceList,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    displayTabs: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof ResourceList>;

export default meta;

type Story = StoryObj<typeof ResourceList>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const Default: Story = {
  args: {
    displayTabs: true,
  },
};