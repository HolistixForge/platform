import type { Meta, StoryObj } from '@storybook/react';

import { ColorPicker } from './color-picker';

/**
 * The palette itself lives in a Radix popover (rendered in a portal), so only
 * the trigger swatch is captured by the screenshot suite. Click the swatch in
 * the canvas to inspect the grid and the opacity slider.
 */
const meta = {
  title: 'Forms/Fields/ColorPicker',
  component: ColorPicker,
  parameters: { layout: 'centered' },
  args: {
    buttonTitle: 'Pick a color',
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;

type Story = StoryObj<typeof ColorPicker>;

export const Normal: Story = {
  args: {
    initialColor: '#0066FF',
  },
};

/** With `withTransparency`, the popover also exposes an opacity slider. */
export const WithTransparency: Story = {
  args: {
    initialColor: '#FF00FF',
    initialOpacity: 40,
    withTransparency: true,
  },
};
