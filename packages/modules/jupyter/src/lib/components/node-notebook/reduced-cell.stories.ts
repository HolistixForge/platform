import type { Meta, StoryObj } from '@storybook/react';

import { ReducedCell } from './reduced-cell';

const meta = {
  title: 'Modules/Jupyter/Components/Reduced Cells',
  component: ReducedCell,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: {
        type: 'select',
        options: ['normal', 'validate', 'running', 'error', 'selected', 'glow'],
      },
    },
  },
} satisfies Meta<typeof ReducedCell>;

export default meta;

type Story = StoryObj<typeof ReducedCell>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21706&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    type: 'normal',
  },
};

export const Validate: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21769&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    type: 'validate',
  },
};

export const Running: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21770&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    type: 'running',
  },
};

export const Error: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21771&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    type: 'error',
  },
};

export const Selected: Story = {
  args: {
    type: 'selected',
  },
};

export const Glow: Story = {
  args: {
    type: 'glow',
  },
};
