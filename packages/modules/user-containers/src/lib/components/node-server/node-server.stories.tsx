import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@holistix-forge/ui-base';
import { TNodeContext } from '@holistix-forge/whiteboard/frontend';
import {
  StoryMockSpaceContextReactflowBgAndCss,
  MockNodeContext,
} from '@holistix-forge/whiteboard/stories';
import { ModuleProvider } from '@holistix-forge/module/frontend';

import { NodeServerInternal } from './node-server';
import {
  makeStoryArgs,
  recentActivityStory,
  withServicesStory,
  StoryArgs,
} from '../server-card-stories';
import { localRunnerFrontend } from '../../local-runner';

//

const exports = {
  reducers: {
    dispatcher: () => {
      /**/
    },
  },
};

const StoryWrapper = (
  props: StoryArgs &
    Pick<TNodeContext, 'filterOut' | 'selected'> & {
      expanded: boolean;
    }
) => {
  //
  const { is: isOpened } = useTestBoolean(true);

  return (
    <ModuleProvider exports={exports}>
      <StoryMockSpaceContextReactflowBgAndCss
        selected={props.selected}
        isOpened={isOpened}
        outputs={0}
      >
        <MockNodeContext>
          <NodeServerInternal
            {...props}
            runners={new Map([['local', localRunnerFrontend]])}
          />
        </MockNodeContext>
      </StoryMockSpaceContextReactflowBgAndCss>
    </ModuleProvider>
  );
};

//

const meta = {
  title: 'Modules/UserContainers/Components/Node Server',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    controls: {
      exclude: [],
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
//

export const Off: Story = {
  args: {
    selected: true,
    expanded: true,
    ...makeStoryArgs(),
  },
};

//

export const RunningRecentActivity: Story = {
  args: {
    selected: true,
    expanded: true,
    ...recentActivityStory(),
  },
};

//

export const WithServices: Story = {
  args: {
    selected: true,
    expanded: true,
    ...withServicesStory(),
  },
};
