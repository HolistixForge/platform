import type { Meta, StoryObj } from '@storybook/react';

import { Tabs } from './tabs';

const meta = {
  title: 'Mvp/Components/tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tabs: {
      control: {
        type: 'array',
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof Tabs>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const Default: Story = {
  args: {
    tabs: [
      {
        tab: "Test 1"
      },
      {
        tab: "Test 2"
      }
    ],
    currentTabs: "Test 1"
  },
};