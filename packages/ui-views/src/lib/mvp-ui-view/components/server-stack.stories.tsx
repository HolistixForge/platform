import type { Meta, StoryObj } from '@storybook/react';
import {
  NodeServerProps,
  ServerStateProps,
} from '../../node-server/node-server';
import { ServerStack } from './server-stack';
import { useState } from 'react';
import { ServerCard } from './server-card';

//

const StoryWrapper = () => {
  const [servers, setServers] = useState<
    (NodeServerProps & ServerStateProps)[]
  >([]);

  return (
    <ServerStack
      onNewServerClick={() => {
        const index = servers.length;
        setServers([
          ...servers,
          {
            server_name: `server-${index}`,
            image: {
              image_name: `image-${index}`,
              image_tag: `tag-${index}`,
              image_sha256: null,
            },
            gatewayFQDN: `${index}`,
            httpServices: [
              {
                port: 8888,
                name: 'jupyterlab',
                location: `/${index}/jupyterlab`,
              },
            ],
            ip: `172.16.0.${index}`,
            last_watchdog_at: new Date(),
            last_activity: new Date(),
          },
        ]);
      }}
    >
      {servers.map((s) => (
        <ServerCard {...s} />
      ))}
    </ServerStack>
  );
};

//

const meta = {
  title: 'Mvp/Components/server-stack',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?node-id=687-19311&m=dev',
    },
  },
  args: {},
};
