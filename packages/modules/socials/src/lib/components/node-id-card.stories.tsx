import type { Meta, StoryObj } from '@storybook/react';

import { IDCard } from './node-id-card';
import { randomGuy } from '@holistix/ui-base';
import { TG_User } from '@holistix/demiurge-types';

const IDCardStory = ({
  user,
  color,
  lanyard,
}: {
  user: TG_User;
  color: string;
  lanyard: boolean;
}) => {
  return <IDCard user={user} color={color} lanyard={lanyard} />;
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
    lanyard: false,
  },
};
