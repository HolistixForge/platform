import type { Meta, StoryObj } from '@storybook/react';

import { ReplyItem } from './replyItem';

const meta = {
  title: 'Modules/Chats/Components/Reply Item',
  component: ReplyItem,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof ReplyItem>;

export default meta;

type Story = StoryObj<typeof ReplyItem>;

export const Normal: Story = {
  args: {
    username: 'local:John',
    content: 'Lorem ipsum dolor sit am',
    color: 'var(--orange-200)',
    space: 'space54',
    id: '89461896',
    date: new Date(),
    replied: {
      picture: '',
      username: 'gitlab:Dave',
      content: 'Amet consectetur adispicing elit',
      color: 'var(--primary-500)',
      space: 'space54',
      id: '61896894',
      date: new Date(),
    },
  },
};
