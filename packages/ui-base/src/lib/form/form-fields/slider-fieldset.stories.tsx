import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { SliderFieldset, SliderFieldsetProps } from './slider-fieldset';

/** The slider is controlled — hold the value in the story wrapper. */
const Wrap = ({ value: initial, ...props }: SliderFieldsetProps) => {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: '360px' }}>
      <SliderFieldset {...props} value={value} onChange={setValue} />
    </div>
  );
};

const meta = {
  title: 'Base/Components/Forms/Fields/Slider',
  component: Wrap,
  parameters: { layout: 'centered' },
  args: {
    name: 'cpu',
    label: 'CPU',
    value: 40,
  },
} satisfies Meta<typeof Wrap>;

export default meta;

type Story = StoryObj<typeof Wrap>;

export const Normal: Story = {};

export const WithSuffix: Story = {
  args: {
    name: 'memory',
    label: 'Memory',
    value: 8,
    min: 1,
    max: 64,
    valueSuffix: 'GB',
  },
};

export const Optional: Story = {
  args: {
    required: false,
  },
};

export const WithoutValue: Story = {
  args: {
    displayValue: false,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
