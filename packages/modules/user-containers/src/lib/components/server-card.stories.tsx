import type { Meta, StoryObj } from '@storybook/react';

import { ServerCardInternal } from './server-card';
import {
  makeStoryArgs,
  recentActivityStory,
  withServicesStory,
  StoryArgs,
} from './server-card-stories';
import { localRunnerFrontend } from '../local-runner';

//

const StoryWrapper = (props: StoryArgs) => {
  return (
    <ServerCardInternal
      {...props}
      runners={new Map([['local', localRunnerFrontend]])}
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
      exclude: ['image', 'oauth', 'ip'],
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
