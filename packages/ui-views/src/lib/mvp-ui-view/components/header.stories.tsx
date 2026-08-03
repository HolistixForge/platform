import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from '@storybook/test';

import {
  useNotImplemented,
  randomGuy,
  randomGuys,
} from '@holistix-forge/ui-base';

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

/**
 * Guards the regression where `w-full` (`width: 100%`) plus 24px of horizontal
 * padding on a `content-box` element made the bar 48px wider than its
 * container, so the notification bell hung off the right edge of the screen.
 */
export const StaysInsideItsContainer: Story = {
  args: {
    hasNotifications: true,
    host: true,
    share: true,
    user: randomGuy(),
    otherUsers: randomGuys,
  },
  render: (args) => (
    <div style={{ width: '1100px', overflow: 'visible' }}>
      <StoryWrapper {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const nav = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('.app-header');
      if (!el) throw new Error('header not rendered');
      return el;
    });

    const bar = nav.getBoundingClientRect();
    expect(Math.round(bar.width)).toBe(1100);

    for (const child of Array.from(nav.children)) {
      const box = child.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(bar.left);
      expect(box.right).toBeLessThanOrEqual(bar.right);
    }
  },
};
