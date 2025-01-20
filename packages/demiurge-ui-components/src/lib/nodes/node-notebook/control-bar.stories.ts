import type { Meta, StoryObj } from '@storybook/react';

import { ControlBar } from './control-bar';

const meta = {
  title: 'Nodes/Notebook/Asset/ControlBar',
  component: ControlBar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof ControlBar>;

export default meta;

type Story = StoryObj<typeof ControlBar>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-19311&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {},
};
