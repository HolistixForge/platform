import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/demiurge-ui-components';
import { TNodeContext, StoryMockSpaceContext } from '@monorepo/space';

import { NodeServer } from './node-server';
import {
  newServerLocationNoneStory,
  cloudRunningStory,
  recentActivityStory,
  hostedWithServicesStory,
  cloudStoppedStory,
  hostedNotAliveCurrentUserHosting,
  hostedNotAliveCurrentUserNotHosting,
} from '../server-card-stories';
import {
  TServerComponentCallbacks,
  TServerComponentProps,
} from '../../servers-types';
import { randomGuy } from '@monorepo/demiurge-ui-components';
import { useMockServerBehaviours } from '../server-card-mock';

//

const StoryWrapper = (
  props: TServerComponentProps &
    TServerComponentCallbacks &
    Pick<TNodeContext, 'id'> & {
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

  const state = useMockServerBehaviours(props);

  return (
    <StoryMockSpaceContext selected={props.selected} isOpened={isOpened}>
      <NodeServer
        expand={expand}
        reduce={reduce}
        viewStatus={{
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
          forceClosed: false,
          forceOpened: false,
          rank: 1,
          maxRank: 2,
          isFiltered: false,
        }}
        onCopyCommand={props.onCopyCommand}
        isOpened={isOpened}
        open={open}
        close={close}
        id={props.id}
        {...state}
      />
    </StoryMockSpaceContext>
  );
};

//

const meta = {
  title: 'Nodes/Server',
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
//

export const NewServerLocationNone: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...newServerLocationNoneStory(),
  },
};

//

export const CloudRunning: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...cloudRunningStory(),
  },
};

//

export const CloudStopped: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...cloudStoppedStory(),
  },
};

//

export const CloudRunningRecentActivity: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...recentActivityStory(),
  },
};

//

export const HostedNotAliveCurrentUserHosting: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...hostedNotAliveCurrentUserHosting(),
  },
};

//

export const HostedNotAliveCurrentUserNotHosting: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...hostedNotAliveCurrentUserNotHosting(),
  },
};

//

export const HostedWithServices: Story = {
  args: {
    id: 'node-1',
    selected: true,
    expanded: true,
    ...hostedWithServicesStory(),
  },
};
