import type { Meta, StoryObj } from '@storybook/react';

import {
  MockNodeContext,
  StoryMockSpaceContextReactflowBgAndCss,
} from '@holistix-forge/whiteboard/stories';

import { NodeKernel } from './node-kernel';
import {
  JupyterStoryProviders,
  JupyterStorySeed,
} from '../../stories/module-stories-utils';

// `jupyter-kernel` is one of the three nodes the Jupyter module registers, and
// it had no story. Unlike `shape` or `group` it cannot be drawn from its props
// alone: it reads the container and the kernel out of shared data, and reaches
// the JLsManager through the module context. So it needs the module stack, and
// then it needs something in the shared data to find.
//
// Seeding happens in a child of the providers rather than in a module: the
// shared data does not exist until collab has been loaded, and a module's
// `load` runs too early to write into it.

const CONTAINER_ID = '0';
const KERNEL_ID = 'kernel-story';

const node = {
  id: 'kernel-node',
  name: 'kernel-node',
  root: true,
  type: 'jupyter-kernel',
  connectors: [],
  data: { kernel_id: KERNEL_ID, user_container_id: CONTAINER_ID },
} as unknown as Parameters<typeof NodeKernel>[0]['node'];

const kernels = {
  [KERNEL_ID]: { kernel_id: KERNEL_ID, name: 'python3', state: 1 },
};

const StoryWrapper = () => (
  <JupyterStoryProviders>
    <JupyterStorySeed kernels={kernels}>
      <StoryMockSpaceContextReactflowBgAndCss nodeId="kernel-node">
        <MockNodeContext>
          <div style={{ width: '260px', height: '200px', position: 'relative' }}>
            <NodeKernel node={node} />
          </div>
        </MockNodeContext>
      </StoryMockSpaceContextReactflowBgAndCss>
    </JupyterStorySeed>
  </JupyterStoryProviders>
);

const meta = {
  title: 'Modules/Jupyter/Components/Nodes/Kernel',
  component: StoryWrapper,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

// One story, not one per kernel state.
//
// The node shows "Unreachable" whenever the Jupyter server does not answer,
// and no server answers in a story — so a `state: 0` and a `state: 1` story
// rendered identical pixels. Two stories that cannot differ are worse than one
// that is honest about what it shows; `NotebookView` had four of them.
//
// What this does prove, and what nothing proved before: the node resolves its
// container, its jupyterlab service and its kernel out of shared data, and
// reports the server's absence rather than its own.
export const Unreachable: Story = { args: {} };
