import type { Meta, StoryObj } from '@storybook/react';
import { UserUsername } from './users';

const UserUsernameStory = ({
  username,
  color,
}: {
  username: string;
  color: string;
}) => {
  return (
    <UserUsername
      username={username}
      color={color}
      firstname={'ducon'}
      lastname={'Lajoie'}
    />
  );
};

const meta = {
  title: 'Users/UserUsername',
  component: UserUsernameStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof UserUsernameStory>;

export default meta;

type Story = StoryObj<typeof UserUsernameStory>;

export const Local: Story = {
  args: {
    username: 'local:duconLajoie42',
    color: 'blue',
  },
};

export const Github: Story = {
  args: {
    username: 'github:duconLajoie42',
    color: 'red',
  },
};

export const Gitlab: Story = {
  args: {
    username: 'gitlab:duconLajoie42',
    color: 'green',
  },
};

export const LinkedIn: Story = {
  args: {
    username: 'linkedin:duconLajoie42',
    color: 'purple',
  },
};

export const Discord: Story = {
  args: {
    username: 'discord:duconLajoie42',
    color: 'orange',
  },
};
