import type { Meta, StoryObj } from '@storybook/react';

import { useNotImplemented, randomGuy, randomGuys } from '@holistix-forge/ui-base';

import { Header, HeaderProps } from './header';

//

const StoryWrapper = (
  props: Pick<
    HeaderProps,
    'hasNotifications' | 'host' | 'share' | 'user' | 'otherUsers'
  >
) => {
  const ni = useNotImplemented();
  return (
    <div style={{ width: '100%' }}>
      <Header {...props} logoutAction={ni} />
    </div>
  );
};

const meta = {
  title: 'Mvp/Components/header',
  component: StoryWrapper,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    hasNotifications: {
      control: {
        type: 'boolean',
      },
    },
    host: {
      control: {
        type: 'boolean',
      },
    },
    share: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const LoggedIn: Story = {
  args: {
    hasNotifications: true,
    host: true,
    share: true,
    user: randomGuy(),
    otherUsers: randomGuys,
  },
};

export const OneOtherUser: Story = {
  args: {
    hasNotifications: true,
    host: true,
    share: true,
    user: randomGuy(),
    otherUsers: [randomGuy()],
  },
};

export const Logout: Story = {
  args: {
    hasNotifications: true,
    host: true,
    share: true,
    user: undefined,
  },
};
