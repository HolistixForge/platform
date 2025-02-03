import {
  TServerComponentCallbacks,
  TServerComponentProps,
} from '@monorepo/demiurge-types';
import { randomGuy } from '../../utils/random-guys';
import { sleep } from '../../storybook-utils';

const image = {
  image_id: 0,
  image_name: 'jupyterlab pytorch',
  image_tag: '4.8.2',
  image_sha256: 'xxxx',
};

type Story = TServerComponentCallbacks & TServerComponentProps;

const ni = async function (): Promise<void> {
  await sleep(3);
  throw new Error('Function not implemented.');
};

const callbacks: TServerComponentCallbacks = {
  onCloudStart: ni,
  onCloudStop: ni,
  onCloudDelete: ni,
  onCopyCommand: async () => {
    await sleep(1.5);
    return 'docker run -it xxxxxxx ...';
  },
  onHost: ni,
  onCloud: ni,
  onDelete: ni,
};

export const newServerLocationNoneStory = (): Story => ({
  server_name: 'My Super Server',
  image,
  last_watchdog_at: null,
  last_activity: null,
  httpServices: [],
  location: 'none',
  gatewayFQDN: '',
  ec2_instance_state: null,
  ...callbacks,
  oauth: [],
  ip: '172.16.0.32',
  system: {
    cpu: {
      usage: '0.08, 0.18, 0.11',
      count: '4',
      threads_per_core: '2',
      model: 'Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz',
    },
    memory: {
      free: 13935,
      total: 15926,
    },
    disk: {
      size: '251.0G',
      usage: '13.00%',
    },
    network: {
      ping_time: '197.507/202.170/209.814/5.448 ms',
    },
    graphic: {
      cards: 'Nvidia TRX3060 Cuda 12.6',
    },
  },
});

//

export const cloudRunningStory = (): Story => ({
  ...newServerLocationNoneStory(),
  ip: '172.16.0.26',
  last_watchdog_at: new Date(),
  location: 'aws',
  ec2_instance_state: 'running',
});

//

export const cloudStoppedStory = (): Story => ({
  ...newServerLocationNoneStory(),
  ip: '172.16.0.26',
  location: 'aws',
  ec2_instance_state: 'stopped',
});

//

export const recentActivityStory = (): Story => ({
  ...newServerLocationNoneStory(),
  ip: '172.16.0.26',
  last_watchdog_at: new Date(),
  last_activity: new Date(),
  location: 'aws',
  ec2_instance_state: 'running',
});

//

export const hostedNotAliveCurrentUserHosting = (): Story => ({
  ...newServerLocationNoneStory(),
  host: randomGuy(),
  location: 'hosted',
});

export const hostedNotAliveCurrentUserNotHosting = (): Story => ({
  ...newServerLocationNoneStory(),
  host: randomGuy(),
  location: 'hosted',
  onCopyCommand: undefined,
});

//

export const hostedWithServicesStory = (): Story => ({
  ...newServerLocationNoneStory(),
  ip: '172.16.0.26',
  last_watchdog_at: new Date(),
  last_activity: new Date(),
  httpServices: [
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
  host: randomGuy(),
  location: 'hosted',
});
