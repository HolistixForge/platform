import type { Meta, StoryObj } from '@storybook/react';
import { FormError } from './form-errors';

const errors = {
  name: 'this name is used yet, choose another one',
  date: "can't be in the past",
  age: 'you must be born yet',
};

const ids = Object.keys(errors);

const meta: Meta<typeof FormError> = {
  component: FormError,
  title: 'Forms/Errors/FormError',
  argTypes: {
    id: {
      options: ids,
      mapping: ids,
      control: {
        type: 'select',
        labels: ids,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof FormError>;

export const Primary: Story = {
  args: {
    errors,
    id: 'name',
  },
};
