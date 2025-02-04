import type { Meta, StoryObj } from '@storybook/react';

import { ResourceBar } from './resource-bar';

const meta = {
  title: 'Mvp/Components/resource-bar',
  component: ResourceBar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    title: {
      control: {
        type: 'text',
      },
    },
    tags: {
      control: {
        type: 'object',
      },
    },
    buttonPrimary: {
      control: {
        type: 'select',
      },
      options: ['', 'play', 'stop', 'pause', 'enter'],
    },
    buttonSecondary: {
      control: {
        type: 'select',
      },
      options: ['', 'play', 'stop', 'pause', 'enter'],
    },
    warningColor: {
      control: {
        type: 'select',
      },
      options: ['green', 'red', 'yellow', 'blue'],
    },
    host: {
      control: {
        type: 'boolean',
      },
    },
    path: {
      control: {
        type: 'text',
      },
    },
  },
} satisfies Meta<typeof ResourceBar>;

export default meta;

type Story = StoryObj<typeof ResourceBar>;

export const Default: Story = {
  args: {
    title: 'Notebook Server',
    tags: [
      {
        name: 'Role',
        color: '#C25D50',
      },
      {
        name: 'Montpellier_data',
        color: '#AA5ECE',
      },
    ],
    buttonPrimary: 'play',
    buttonSecondary: '',
    warningColor: 'green',
    host: true,
    path: 'root/app/project_weather/notebook2.ipynb',
    tabs: [{ tab: 'tab-1' }, { tab: 'tab-2' }],
  },
};
