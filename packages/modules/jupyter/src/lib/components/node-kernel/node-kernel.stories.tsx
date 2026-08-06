import { useEffect, useState, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import {
  MockNodeContext,
  StoryMockSpaceContextReactflowBgAndCss,
} from '@holistix-forge/whiteboard/stories';

import { NodeKernel } from './node-kernel';
import { JupyterStoryProviders } from '../../stories/module-stories-utils';
import { TJupyterSharedData } from '../../jupyter-shared-model';

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

const Seed = ({
  children,
  state,
}: {
  children: ReactNode;
  state: number;
}) => {
  const [seeded, setSeeded] = useState(false);
  const sd = useLocalSharedData<
    TUserContainersSharedData & TJupyterSharedData
  >(['user-containers:containers', 'jupyter:servers'], (s) => s);

  useEffect(() => {
    sd['user-containers:containers'].set(CONTAINER_ID, {
      user_container_id: CONTAINER_ID,
      container_name: 'story-jupyter',
      image_id: 'jupyter:minimal',
      httpServices: [],
      ip: '127.0.0.1',
      last_watchdog_at: '2026-01-01T00:00:00.000Z',
      last_activity: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      runner: { id: 'local' },
      auth_guard: { client_id: 'story-client' },
    } as unknown as TUserContainer);

    sd['jupyter:servers'].set(CONTAINER_ID, {
      user_container_id: CONTAINER_ID,
      kernels: {
        [KERNEL_ID]: {
          kernel_id: KERNEL_ID,
          name: 'python3',
          state,
        },
      },
      cells: {},
      terminals: {},
    } as never);

    setSeeded(true);
  }, [sd, state]);

  // Rendering the node before its data exists is the one state this story is
  // not about; it would show the empty case for a frame and make every
  // screenshot a race.
  return seeded ? <>{children}</> : null;
};

const node = {
  id: 'kernel-node',
  name: 'kernel-node',
  root: true,
  type: 'jupyter-kernel',
  connectors: [],
  data: { kernel_id: KERNEL_ID, user_container_id: CONTAINER_ID },
} as unknown as Parameters<typeof NodeKernel>[0]['node'];

const StoryWrapper = ({ state }: { state: number }) => (
  <JupyterStoryProviders>
    <Seed state={state}>
      <StoryMockSpaceContextReactflowBgAndCss nodeId="kernel-node">
        <MockNodeContext>
          <div style={{ width: '260px', height: '200px', position: 'relative' }}>
            <NodeKernel node={node} />
          </div>
        </MockNodeContext>
      </StoryMockSpaceContextReactflowBgAndCss>
    </Seed>
  </JupyterStoryProviders>
);

const meta = {
  title: 'Modules/Jupyter/Components/Nodes/Kernel',
  component: StoryWrapper,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = { args: { state: 0 } };

export const Running: Story = { args: { state: 1 } };
