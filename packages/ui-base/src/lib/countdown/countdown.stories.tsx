import type { Meta, StoryObj } from '@storybook/react';

import { Countdown } from './countdown';

const meta = {
  title: 'Basics/Countdown',
  component: Countdown,
  parameters: { layout: 'centered' },
  args: {
    onComplete: () => undefined,
  },
} satisfies Meta<typeof Countdown>;

export default meta;

type Story = StoryObj<typeof Countdown>;

/**
 * Target already in the past: the countdown sits at `00:00` and `onComplete`
 * has already fired. This is the deterministic story used as the visual
 * regression baseline.
 */
export const Completed: Story = {
  args: {
    targetDate: new Date('2020-01-01T00:00:00.000Z'),
  },
};

/**
 * A live countdown. Excluded from the screenshot suite: the rendered digits
 * change every second.
 */
export const Running: Story = {
  tags: ['no-visual-test'],
  render: (args) => (
    <Countdown {...args} targetDate={new Date(Date.now() + 5 * 60 * 1000)} />
  ),
  args: {
    targetDate: new Date('2020-01-01T00:00:00.000Z'),
  },
};
