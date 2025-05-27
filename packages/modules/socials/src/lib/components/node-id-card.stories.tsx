import type { Meta, StoryObj } from '@storybook/react';

import { IDCard } from './node-id-card';
import { randomGuy } from '@monorepo/ui-base';
import { TG_User } from '@monorepo/demiurge-types';

const IDCardStory = ({ user, color }: { user: TG_User; color: string }) => {
  return <IDCard user={user} color={color} />;
};

const meta = {
  title: 'Users/IDCard',
  component: IDCardStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof IDCardStory>;

export default meta;

type Story = StoryObj<typeof IDCardStory>;

const u = randomGuy();

export const Normal: Story = {
  args: {
    user: u,
    color: u.color,
  },
};
