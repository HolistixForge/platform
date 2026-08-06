import type { Meta, StoryObj } from '@storybook/react';
import { WrapperCssCoordinates } from './wrapper-css-coordinates';

import { within } from '@storybook/test';
import { expect } from '@storybook/test';

const meta: Meta<typeof WrapperCssCoordinates> = {
  component: WrapperCssCoordinates,
  title: 'Base/Components/WrapperCssCoordinates',
};
export default meta;
type Story = StoryObj<typeof WrapperCssCoordinates>;

export const Primary: Story = {
  args: {
    children: (
      <div
        style={{
          width: '300px',
          height: '300px',
          background: `linear-gradient(45deg, var(--orange-200), var(--green-400))`,
          backgroundPosition: 'var(--x) var(--y)',
          backgroundSize: '400%',
        }}
      >
        Welcome to WrapperCssCoordinates!
      </div>
    ),
    clearOnLeave: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Welcome to WrapperCssCoordinates!/gi)
    ).toBeTruthy();
  },
};
