import type { Meta, StoryObj } from '@storybook/react';

import { HiveTag } from './hive-tag';

const meta = {
  title: 'Nodes/Notebook/Asset/HiveTag',
  component: HiveTag,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    color: {
      control: {
        type: 'text',
      },
    },
  },
} satisfies Meta<typeof HiveTag>;

export default meta;

type Story = StoryObj<typeof HiveTag>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-19250&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    color: 'bg-white',
  },
};
