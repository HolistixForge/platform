import type { Meta, StoryObj } from '@storybook/react';
import { sleep, useTestBoolean } from '../../storybook-utils';
import {
  NodeJupyterlabCodeCell,
  NodeJupyterlabCodeCellProps,
} from './node-jupyterlab-code-cell';
import {
  StoryMockSpaceContext,
  nodeViewDefaultStatus,
} from '../../demiurge-space-2';

//

const StoryWrapper = (
  props: Omit<
    NodeJupyterlabCodeCellProps,
    | 'viewStatus'
    | 'expand'
    | 'reduce'
    | 'onExecute'
    | 'onClearOutput'
    | 'onDelete'
    | 'onEditorMount'
    | 'isOpened'
    | 'open'
    | 'close'
  > & {
    expanded: boolean;
    selected: boolean;
  }
) => {
  //
  const { is: isOpened, set: open, unset: close } = useTestBoolean(true);
  const {
    is: isExpanded,
    set: expand,
    unset: reduce,
  } = useTestBoolean(props.expanded);

  return (
    <StoryMockSpaceContext selected={props.selected} isOpened={isOpened}>
      <NodeJupyterlabCodeCell
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        onExecute={() => null}
        onClearOutput={() => null}
        onDelete={() => sleep()}
        onEditorMount={() => null}
        isOpened={isOpened}
        open={open}
        close={close}
        {...props}
      >
        coucou
      </NodeJupyterlabCodeCell>
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Jupyter Lab Code Cell',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    color: {
      control: {
        type: 'color',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Primary: Story = {
  args: {
    id: 'node-1',
    selected: true,
    code: 'print("Hello World !")',
    expanded: true,
  },
};
