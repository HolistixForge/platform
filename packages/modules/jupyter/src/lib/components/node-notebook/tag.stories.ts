import type { Meta, StoryObj } from '@storybook/react';

import { playAdd__hover } from '@holistix/ui-base';

import { Tag } from './tag';

const meta = {
  title: 'Modules/Jupyter/Components/Tag',
  component: Tag,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    text: {
      control: {
        type: 'text',
      },
    },
    textColor: {
      control: {
        type: 'color',
      },
    },
    crowned: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof Tag>;

export default meta;

type Story = StoryObj<typeof Tag>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-18791&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    text: 'Data nettoyage',
    textColor: '#9F2EBB',
    crowned: false,
  },
};

export const Hover: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21852&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    text: 'Data nettoyage',
    textColor: '#9F2EBB',
    crowned: false,
  },
  play: playAdd__hover('tag'),
};

export const Crowned: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=694-21812&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    text: 'Data nettoyage',
    textColor: '#9F2EBB',
    crowned: true,
  },
};
