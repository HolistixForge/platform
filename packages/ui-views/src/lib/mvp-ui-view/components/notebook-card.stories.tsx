import type { Meta, StoryObj } from '@storybook/react';

import { NotebookCard, NotebookCardProps } from './notebook-card';
import { randomGuy, randomGuys } from '../../utils/random-guys';
import { useState } from 'react';
import { TagsBarProps } from './tags';

const StoryWrapper = (
  props: Pick<
    NotebookCardProps & TagsBarProps,
    'status' | 'groups' | 'host' | 'tags' | 'addTag'
  > & {
    userCount: number;
  },
) => {
  const { userCount, tags, ...others } = props;

  const [t, setT] = useState(tags || []);

  const addTag = (a: { text: string; color: string }) => {
    setT([...t, a]);
  };

  return (
    <NotebookCard
      {...others}
      tags={t}
      addTag={addTag}
      liveUsers={randomGuys.slice(0, userCount)}
    />
  );
};

const meta = {
  title: 'Mvp/Components/notebook-card',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    status: {
      control: {
        type: 'select',
        options: [
          'running',
          'loading',
          'stopped',
          'runningLive',
          'hosted',
          'hostedLive',
        ],
      },
    },
    userCount: {
      control: { type: 'number' },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

// variable de definition : le Type de Resource (Notebook server ect.. ) et les Boutton, et le warning
export const Default: Story = {
  args: {
    status: 'running',
    userCount: 0,
  },
};

export const Tags: Story = {
  args: {
    status: 'running',
    userCount: 0,
    tags: [
      { text: 'Lorem', color: '#ff0000' },
      { text: 'Ipsum', color: '#00ff00' },
      { text: 'Dolor', color: '#0000ff' },
      { text: 'Sit', color: '#ff00ff' },
      { text: 'Amet', color: '#ffff00' },
      { text: 'Consectetur', color: '#00ffff' },
      { text: 'Adispicing', color: '#ff8000' },
      { text: 'Elit', color: '#8000ff' },
      { text: 'tag-9', color: '#ff0080' },
      { text: 'tag-10', color: '#0080ff' },
      { text: 'tag-11', color: '#80ff00' },
      { text: 'tag-12', color: '#ff8080' },
      { text: 'tag-13', color: '#8080ff' },
    ],
  },
};

export const Grouped: Story = {
  args: {
    status: 'running',
    groups: true,
    userCount: 0,
  },
};

export const RunningLive: Story = {
  args: {
    status: 'running',
    userCount: 3,
  },
};

export const RunningHosted: Story = {
  args: {
    status: 'running',
    userCount: 5,
    host: randomGuy(),
  },
};

export const RunningHostedLive: Story = {
  args: {
    status: 'running',
    userCount: 8,
    host: randomGuy(),
    groups: true,
  },
};

export const Stopped: Story = {
  args: {
    status: 'stopped',
    userCount: 8,
  },
};
