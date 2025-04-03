import type { Meta, StoryObj } from '@storybook/react';
import { useTestToolbarButtons } from './node-main-toolbar';
import { NodeHeader } from './node-header';

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
  return (
    <div style={{ width: '400px' }}>
      <NodeHeader
        buttons={buttons}
        className={className}
        nodeType={'Story'}
        isOpened={isOpened}
        open={function (): void {
          throw new Error('Function not implemented.');
        }}
        id={'story'}
        visible={true}
      />
    </div>
  );
};

//
//

const meta = {
  title: 'Modules/Space/Components/Node Header',
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
  },
};
