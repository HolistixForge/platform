import type { Meta, StoryObj } from '@storybook/react';
import { FormErrors } from './form-errors';

const errors = {
  name: 'this name is used yet, choose another one',
  date: "can't be in the past",
  age: 'you must be born yet',
};

const meta: Meta<typeof FormErrors> = {
  component: FormErrors,
  title: 'Forms/Errors/FormErrors',
};
export default meta;
type Story = StoryObj<typeof FormErrors>;

export const Primary: Story = {
  args: { errors },
};
