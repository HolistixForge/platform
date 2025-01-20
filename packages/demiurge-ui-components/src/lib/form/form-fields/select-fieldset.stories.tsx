import type { Meta, StoryObj } from '@storybook/react';
import {
  SelectFieldset,
  SelectFieldsetProps,
  SelectItem,
} from './select-fieldset';
import * as Select from '@radix-ui/react-select';

//

const StoryWrapper = (props: SelectFieldsetProps) => {
  const onChange = (d: any) => console.log(d);

  return (
    <div style={{ width: '350px' }}>
      <SelectFieldset {...props} name="xxx" onChange={onChange}>
        <Select.Group>
          <Select.Label className="SelectLabel">Choices Group</Select.Label>
          {new Array(18).fill(1).map((i, k) => (
            <SelectItem key={k} value={`choice ${k}`} title={`choice ${k}`}>
              choice {k}
            </SelectItem>
          ))}
        </Select.Group>
      </SelectFieldset>
    </div>
  );
};

//

const meta = {
  title: 'Forms/Fields/Select',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  args: {
    label: 'my label',
    placeholder: 'My Placeholder',
    value: 'choice 13',
  },
};
