import type { Meta, StoryObj } from '@storybook/react';

import { DisplayMenu } from './display-menu';

const meta = {
  title: 'Nodes/Notebook/Asset/DisplayMenu',
  component: DisplayMenu,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof DisplayMenu>;

export default meta;

type Story = StoryObj<typeof DisplayMenu>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-20385&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {},
};
