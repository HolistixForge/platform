import type { Meta, StoryObj } from '@storybook/react';
import { TextFieldset, TextFieldsetProps } from './text-fieldset';
import React from 'react';

//

const StoryWrapper = (
  props: Pick<
    TextFieldsetProps,
    | 'label'
    | 'placeholder'
    | 'type'
    | 'value'
    | 'disabled'
    | 'copyButton'
    | 'required'
  >,
) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    console.log(e.target.value);
  return <TextFieldset {...props} name="xxx" onChange={onChange} />;
};

//

const meta = {
  title: 'Forms/Fields/Text',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      options: ['text', 'password', 'email', 'number'],
      mapping: ['text', 'password', 'email', 'number'],
      control: {
        type: 'select',
        labels: ['text', 'password', 'email', 'number'],
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  args: {
    label: 'my label',
    placeholder: 'My Placeholder',
    type: 'text',
    value: 'xxxx',
  },
};

export const Password: Story = {
  args: {
    label: 'password',
    placeholder: 'My Password',
    type: 'password',
    value: 'xxxx',
  },
};

export const Email: Story = {
  args: {
    label: 'Email',
    placeholder: 'My email',
    type: 'email',
    value: 'xxxx',
    required: true,
  },
};

export const Number: Story = {
  args: {
    label: 'Storage',
    placeholder: 'storage',
    type: 'number',
    value: '15',
    required: true,
  },
};

export const Copy: Story = {
  args: {
    placeholder: 'My email',
    type: 'email',
    value:
      '2fc6e27701b4cae015ff41e00c97abde3628eef58556f3f6a71392d84aa4ed13a5ebf98ef7872082848ab09e48f5a7d45e77',
    disabled: true,
    copyButton: true,
  },
};
