import type { Meta, StoryObj } from '@storybook/react';

import { ServersCreateView } from './servers-create-view';

const meta = {
  title: 'Mvp/View/servers-create-view',
  component: ServersCreateView,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof ServersCreateView>;

export default meta;

type Story = StoryObj<typeof ServersCreateView>;

export const Normal: Story = {
  args: {},
};
