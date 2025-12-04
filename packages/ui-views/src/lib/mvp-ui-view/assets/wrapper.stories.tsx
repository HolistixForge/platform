import type { Meta, StoryObj } from '@storybook/react';

import { randomGuy } from '@holistix-forge/ui-base';

import { Wrapper } from './wrapper';

//

const meta = {
  title: 'Mvp/Assets/wrapper',
  component: Wrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tag: {
      control: {
        type: 'text',
      },
    },
    tagSecondary: {
      control: {
        type: 'text',
      },
    },
    tagColor: {
      control: {
        type: 'color',
      },
    },
    tagSecondaryColor: {
      control: {
        type: 'color',
      },
    },
    resizeBorderColor: {
      control: {
        type: 'color',
      },
    },
    user: {
      control: {
        type: 'object',
      },
    },
    displaySettings: {
      control: {
        type: 'boolean',
      },
    },
    displayRemove: {
      control: {
        type: 'boolean',
      },
    },
    displayDelete: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;

type Story = StoryObj<typeof Wrapper>;

export const Default: Story = {
  args: {
    tag: 'team sync_13',
    tagColor: '#7588B9',
    resizeBorderColor: '#7588B9',
    user: randomGuy(),
    displayDelete: true,
    displayRemove: true,
    displaySettings: true,
  },
};

export const OptionnalTag: Story = {
  args: {
    tag: 'team sync_13',
    tagColor: '#7588B9',
    tagSecondary: 'SERVER',
    tagSecondaryColor: '#F4A261',
    resizeBorderColor: '#7588B9',
    user: randomGuy(),
    displayDelete: true,
    displayRemove: true,
    displaySettings: true,
  },
};
