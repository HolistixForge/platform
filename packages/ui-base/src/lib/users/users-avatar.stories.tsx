import type { Meta, StoryObj } from '@storybook/react';

import { UserAvatar, UserAvatarProps } from './users';
import { CSSProperties } from 'react';
import { randomGuy } from '../utils/random-guys';

const UserAvatarStory = (props: UserAvatarProps) => {
  return (
    <div style={{ '--avatar-width': '25px' } as CSSProperties}>
      <UserAvatar {...props} />
    </div>
  );
};

const meta = {
  title: 'Users/UserAvatar',
  component: UserAvatarStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      options: ['small', 'large', 'undefined'],
      mapping: ['small', 'large', undefined],
      control: {
        type: 'select',
        labels: ['small', 'large'],
      },
    },
  },
} satisfies Meta<typeof UserAvatarStory>;

export default meta;

type Story = StoryObj<typeof UserAvatarStory>;

const u = randomGuy();

export const Default: Story = {
  args: {
    ...u,
    live: false,
    host: false,
    size: 'large',
  },
};

export const Host: Story = {
  args: {
    ...u,
    live: false,
    host: true,
    size: 'large',
  },
};

export const Live: Story = {
  args: {
    ...u,
    live: true,
    host: false,
    size: 'large',
  },
};

export const Small: Story = {
  args: {
    ...u,
    live: false,
    host: false,
    size: 'small',
  },
};
