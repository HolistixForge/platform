import type { Meta, StoryObj } from '@storybook/react';

import { UserBubble, UserBubbleProps } from './user-bubble';
import { randomGuys } from '../utils/random-guys';

const StoryWrapper = (
  props: Pick<UserBubbleProps, 'direction' | 'live' | 'size'> & {
    usersCount: number;
  }
) => {
  const { usersCount, ...others } = props;
  return <UserBubble {...others} users={randomGuys.slice(0, usersCount)} />;
};

const meta = {
  title: 'Mvp/Assets/user-bubble',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    direction: {
      control: {
        type: 'radio',
        options: ['horizontal', 'vertical'],
      },
    },
    size: {
      control: {
        type: 'radio',
        options: ['small', 'large'],
      },
    },
    live: {
      control: {
        type: 'boolean',
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const HorizontalSmall: Story = {
  args: {
    direction: 'horizontal',
    size: 'small',
    live: false,
    usersCount: 2,
  },
};

export const HorizontalSmallLive: Story = {
  args: {
    direction: 'horizontal',
    size: 'small',
    live: true,
    usersCount: 2,
  },
};

export const HorizontalLarge: Story = {
  args: {
    direction: 'horizontal',
    size: 'large',
    live: false,
    usersCount: 3,
  },
};

export const HorizontalLargeLive: Story = {
  args: {
    direction: 'horizontal',
    size: 'large',
    live: true,
    usersCount: 3,
  },
};

export const VerticalSmall: Story = {
  args: {
    direction: 'vertical',
    size: 'small',
    live: false,
    usersCount: 2,
  },
};

export const VerticalSmallLive: Story = {
  args: {
    direction: 'vertical',
    size: 'small',
    live: true,
    usersCount: 2,
  },
};

export const VerticalLarge: Story = {
  args: {
    direction: 'vertical',
    size: 'large',
    live: false,
    usersCount: 3,
  },
};

export const VerticalLargeLive: Story = {
  args: {
    direction: 'vertical',
    size: 'large',
    live: true,
    usersCount: 3,
  },
};

//
//
//
//

export const ManyHorizontalSmall: Story = {
  args: {
    direction: 'horizontal',
    size: 'small',
    live: false,
    usersCount: 9,
  },
};

export const ManyHorizontalSmallLive: Story = {
  args: {
    direction: 'horizontal',
    size: 'small',
    live: true,
    usersCount: 9,
  },
};

export const ManyHorizontalLarge: Story = {
  args: {
    direction: 'horizontal',
    size: 'large',
    live: false,
    usersCount: 9,
  },
};

export const ManyHorizontalLargeLive: Story = {
  args: {
    direction: 'horizontal',
    size: 'large',
    live: true,
    usersCount: 9,
  },
};

export const ManyVerticalSmall: Story = {
  args: {
    direction: 'vertical',
    size: 'small',
    live: false,
    usersCount: 10,
  },
};

export const ManyVerticalSmallLive: Story = {
  args: {
    direction: 'vertical',
    size: 'small',
    live: true,
    usersCount: 10,
  },
};

export const ManyVerticalLarge: Story = {
  args: {
    direction: 'vertical',
    size: 'large',
    live: false,
    usersCount: 8,
  },
};

export const ManyVerticalLargeLive: Story = {
  args: {
    direction: 'vertical',
    size: 'large',
    live: true,
    usersCount: 7,
  },
};
