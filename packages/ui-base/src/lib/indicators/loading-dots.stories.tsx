import type { Meta, StoryObj } from '@storybook/react';

import { LoadingDots } from './loading-dots';

const meta = {
  title: 'Base/Assets/LoadingDots',
  component: LoadingDots,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LoadingDots>;

export default meta;

type Story = StoryObj<typeof LoadingDots>;

export const Normal: Story = {};

/** Inline inside a sentence, which is how it is used in the chat modules. */
export const Inline: Story = {
  render: () => (
    <span>
      Waiting for the kernel
      <LoadingDots />
    </span>
  ),
};
