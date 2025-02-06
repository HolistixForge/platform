import type { Meta, StoryObj } from '@storybook/react';
import { Datetime } from './datetime';

const meta: Meta<typeof Datetime> = {
  component: Datetime,
  title: 'Basics/Datetime',
};
export default meta;
type Story = StoryObj<typeof Datetime>;

export const White = {
  args: {
    value: new Date(),
    formats: ['long'],
    hoverFormats: ['ago'],
    style: { color: 'white' },
  },
};

export const Red: Story = {
  args: {
    value: new Date('2023-10-22T23:42:00.000Z'),
    formats: ['long'],
    hoverFormats: ['ago'],
    style: { color: 'red' },
  },
};

export const MultipleFormats: Story = {
  args: {
    value: new Date('2023-10-22T23:42:00.000Z'),
    formats: ['long', 'ago'],
    hoverFormats: ['short', 'ago'],
    style: { color: 'white' },
  },
};

export const ShortHoverLong: Story = {
  args: {
    value: new Date('2023-10-22T23:42:00.000Z'),
    formats: ['short'],
    hoverFormats: ['long'],
    style: { color: 'white' },
  },
};

export const HoverOnly: Story = {
  args: {
    value: new Date('2023-10-22T23:42:00.000Z'),
    hoverFormats: ['short', 'ago'],
    style: { color: 'white' },
  },
};
