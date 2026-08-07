import { useEffect, useState, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { useModuleExports } from '@holistix-forge/module/frontend';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import {
  MockNodeContext,
  StoryMockSpaceContextReactflowBgAndCss,
} from '@holistix-forge/whiteboard/stories';

import { NodeKernel } from './node-kernel';
import {
  JupyterStoryProviders,
  STORY_PROJECT_ID,
} from '../../stories/module-stories-utils';
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

  // Written through the collab instance, not through `useLocalSharedData`.
  // That hook returns `localOverrider.getData()` — the overrider's own local
  // copy — so setting on it writes somewhere JLsManager never reads, and the
  // node showed "Server Does Not Exist" while the story insisted it had seeded
  // a server. `createStoryInitModule` in this package takes the same path.
  const exports = useModuleExports<{ collab: TCollabFrontendExports }>('Seed');
  const sd = exports.collab.getCollabForProject(STORY_PROJECT_ID).collab
    .sharedData as unknown as TUserContainersSharedData & TJupyterSharedData;

  useEffect(() => {
    sd['user-containers:containers'].set(CONTAINER_ID, {
      user_container_id: CONTAINER_ID,
      container_name: 'story-jupyter',
      image_id: 'jupyter:minimal',
      // The kernel resolves its URL through this service; without it the node
      // finds its server and then reports the service missing, which reads as
      // the same failure from outside.
      httpServices: [
        {
          name: 'jupyterlab',
          host: '127.0.0.1',
          port: 36666,
          secure: false,
        },
      ],
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
export const Unreachable: Story = { args: { state: 1 } };
