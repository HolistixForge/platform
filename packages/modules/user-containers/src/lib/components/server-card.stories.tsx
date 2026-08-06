import type { Meta, StoryObj } from '@storybook/react';

import { UserContainerCardInternal } from './server-card';
import {
  makeStoryArgs,
  recentActivityStory,
  withServicesStory,
  runningOnPlatformStory,
  runningLocallyStory,
  runningOnAppleStory,
  runningOnSharedKernelStory,
  StoryArgs,
} from './server-card-stories';
import { randomGuys } from '@holistix-forge/ui-base';

import { localRunnerFrontend } from '../local-runner-frontend';
import { platformRunnerFrontend } from '../platform-runner-frontend';

//

const StoryWrapper = (props: StoryArgs) => {
  return (
    <UserContainerCardInternal
      {...props}
      // The same fixture the notebook card's story uses, so the two can be
      // compared side by side — which is the whole reason they share a layout.
      liveUsers={randomGuys.slice(0, 3)}
      host={randomGuys[0]}
      // Both runners, because the card's point is the choice between them:
      // one registered runner drew a single button with nothing to compare it
      // to, and the cloud half of the pair never appeared in any story.
      runners={
        new Map([
          ['local', localRunnerFrontend],
          ['platform', platformRunnerFrontend],
        ])
      }
    />
  );
};

//

const meta = {
  title: 'Modules/UserContainers/Components/Server Card',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    controls: {
      exclude: ['image', 'auth_guard', 'ip'],
    },
  },
  argTypes: {
    container: {
      last_watchdog_at: {
        options: {
          now: new Date('2100-01-01'),
          undefined: undefined,
          'long time ago': new Date('1970-01-01'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        control: {
          type: 'select',
        },
      },

      last_activity: {
        options: {
          now: new Date('2100-01-01'),
          undefined: undefined,
          'long time ago': new Date('1970-01-01'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        control: {
          type: 'select',
        },
      },

      httpServices: {
        control: {
          type: 'select',
        },
        options: {
          zero: [],
          one: [
            {
              port: 8888,
              name: 'jupyterlab',
              location: 'xxxxx/jupyterlab',
            },
          ],
          two: [
            {
              port: 8888,
              name: 'jupyterlab',
              location: 'xxxxx/jupyterlab',
            },
            {
              port: 8282,
              name: 'postgres-admin',
              location: 'xxxxx/pg',
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

//
//

export const Off: Story = {
  args: { ...makeStoryArgs() },
};

//

export const RunningRecentActivity: Story = {
  args: { ...recentActivityStory() },
};

//

export const WithServices: Story = {
  args: { ...withServicesStory() },
};

//

export const RunningOnPlatform: Story = {
  args: { ...runningOnPlatformStory() },
};

//

export const RunningLocally: Story = {
  args: { ...runningLocallyStory() },
};

//

/**
 * The same placement on a Mac host.
 *
 * Beside `RunningOnPlatform` on purpose: both are microVMs and they are not
 * the same guarantee. If these two stories ever render identically, the card
 * has stopped saying the thing it was changed to say.
 */
export const RunningOnApple: Story = {
  args: { ...runningOnAppleStory() },
};

//

/**
 * A container on the host's own kernel, beside every other tenant.
 *
 * Reachable — `BROKER_RUNTIME=runc` is a stated choice, never a fallback — and
 * the one verdict on this card worth interrupting someone for.
 */
export const RunningOnSharedKernel: Story = {
  args: { ...runningOnSharedKernelStory() },
};
