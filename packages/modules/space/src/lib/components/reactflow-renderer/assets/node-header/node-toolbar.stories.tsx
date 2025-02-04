import type { Meta, StoryObj } from '@storybook/react';
import { NodeToolbar } from './node-toolbar';
import { useTestToolbarButtons } from './node-toolbar';

//
//

const StoryWrapper = ({
  isOpened,
  isLocked,
  className,
}: {
  isOpened: boolean;
  isLocked: boolean;
  className: string;
}) => {
  const { buttons } = useTestToolbarButtons(isOpened, isLocked);
  return <NodeToolbar buttons={buttons} className={className} />;
};

//
//

const meta = {
  title: 'internals/Node Toolbar',
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
    isOpened: false,
    isLocked: false,
    className: 'outside',
  },
};
