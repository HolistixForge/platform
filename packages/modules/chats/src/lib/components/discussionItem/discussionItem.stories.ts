import type { Meta, StoryObj } from '@storybook/react';

import { DiscussionItem } from './discussionItem';

const meta = {
  title: 'ChatBox/Components/DiscussionItem',
  component: DiscussionItem,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof DiscussionItem>;

export default meta;

type Story = StoryObj<typeof DiscussionItem>;

export const Normal: Story = {
  args: {
    date: new Date(),
    username: 'local:John',
    content: 'Lorem ipsum dolor sit am',
    color: 'var(--c-orange-2)',
    space: 'space12',
    id: '89461896',
  },
};
