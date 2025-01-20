import type { Meta, StoryObj } from '@storybook/react';

import { NestedTab } from './Tabs';

//

const meta = {
  title: 'UI/Tabs',
  component: NestedTab,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof NestedTab>;

//

export default meta;

//

type Story = StoryObj<typeof NestedTab>;

//

export const Normal: Story = {
  args: {},
};
