import type { Meta, StoryObj } from '@storybook/react';
import { ServerCard } from './server-card';
import {
  newServerLocationNoneStory,
  cloudRunningStory,
  recentActivityStory,
  hostedWithServicesStory,
  cloudStoppedStory,
  hostedNotAliveCurrentUserHosting,
  hostedNotAliveCurrentUserNotHosting,
} from './server-card-stories';
import { randomGuy } from '../../utils/random-guys';
import {
  TServerComponentCallbacks,
  TServerComponentProps,
} from '@monorepo/demiurge-types';
import { useMockServerBehaviours } from './server-card-mock';

//

const StoryWrapper = (
  props: TServerComponentProps & TServerComponentCallbacks,
) => {
  const state = useMockServerBehaviours(props);
  console.log({ state });
  return <ServerCard {...state} />;
};

//

const meta = {
  title: 'Mvp/Components/server-card',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    controls: {
      exclude: [
        'image',
        'gatewayFQDN',
        'onCloudStart',
        'onCloudStop',
        'onCloudDelete',
        'onCopyCommand',
        'onHost',
        'onCloud',
        'onDelete',
        'oauth',
        'ip',
      ],
    },
  },
  argTypes: {
    ec2_instance_state: {
      control: {
        type: 'select',
      },
      options: [
        'pending',
        'running',
        'shutting-down',
        'stopped',
        'stopping',
        'terminated',
      ],
      description: "only if location is 'aws'",
    },

    location: {
      control: {
        type: 'select',
      },
      options: ['none', 'aws', 'hosted'],
    },

    last_watchdog_at: {
      options: {
        now: new Date('2100-01-01'),
        undefined: undefined,
        'long time ago': new Date('1970-01-01'),
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
      } as any,
    },

    host: {
      control: {
        type: 'select',
      },
      options: {
        undefined: undefined,
        'one guy': randomGuy(),
        'another guy': randomGuy(),
      } as any,
      description: "only if location is 'hosted'",
    },
  },
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

//
//

export const NewServerLocationNone: Story = {
  args: { ...newServerLocationNoneStory() },
};

//

export const CloudRunning: Story = {
  args: { ...cloudRunningStory() },
};

//

export const CloudStopped: Story = {
  args: { ...cloudStoppedStory() },
};

//

export const CloudRunningRecentActivity: Story = {
  args: { ...recentActivityStory() },
};

//

export const HostedNotAliveCurrentUserHosting: Story = {
  args: { ...hostedNotAliveCurrentUserHosting() },
};

//

export const HostedNotAliveCurrentUserNotHosting: Story = {
  args: { ...hostedNotAliveCurrentUserNotHosting() },
};

//

export const HostedWithServices: Story = {
  args: { ...hostedWithServicesStory() },
};
