import type { Meta, StoryObj } from '@storybook/react';
import { Accordion, AccordionProps } from './Accordion';
import { useTestBoolean } from '../storybook-utils';

//

const StoryWrapper = (
  props: Pick<
    AccordionProps,
    'title' | 'content' | 'isOpened' | 'functionName'
  >,
) => {
  const {
    is: isOpened,
    set: open,
    unset: close,
  } = useTestBoolean(props.isOpened);
  return <Accordion {...props} isOpened={isOpened} open={open} close={close} />;
};

//

const meta = {
  title: 'internals/Accordion',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Closed: Story = {
  args: {
    title: 'Super title',
    content: 'Lorem ipsum dolor sit aet consectetur adipiscing elit',
    functionName: 'Function Name',
    isOpened: false,
  },
};

export const Opened: Story = {
  args: {
    title: 'Super title',
    content: 'Lorem ipsum dolor sit aet consectetur adipiscing elit',
    functionName: 'Function Name',
    isOpened: true,
  },
};
