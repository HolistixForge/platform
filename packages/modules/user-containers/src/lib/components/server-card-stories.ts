import { UseContainerProps } from './node-server/node-server';

export type StoryArgs = UseContainerProps;

export const makeStoryArgs = (): StoryArgs => ({
  container: {
    user_container_id: '1',
    container_name: 'My Super Server',
    image_id: '1',
    oauth: [],
    runner: { id: 'none' },
    created_at: new Date().toISOString(),
    last_watchdog_at: null,
    last_activity: null,
    httpServices: [],
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
  },
  image: {
    imageId: '1',
    imageName: 'jupyterlab pytorch',
    description: 'jupyterlab pytorch',
  },
  onDelete: () => Promise.resolve(),
  onOpenService: () => {
    /**/
  },
  onSelectRunner: () => Promise.resolve(),
});

//

export const recentActivityStory = (): StoryArgs => {
  const s = makeStoryArgs();
  s.container.ip = '172.16.0.26';
  s.container.last_watchdog_at = new Date().toISOString();
  s.container.last_activity = new Date().toISOString();
  return s;
};

//

export const withServicesStory = (): StoryArgs => {
  const s = makeStoryArgs();
  s.container.ip = '172.16.0.26';
  s.container.last_watchdog_at = new Date().toISOString();
  s.container.last_activity = new Date().toISOString();
  s.container.httpServices = [
    {
      host: 'xxxxx',
      port: 8888,
      name: 'jupyterlab',
    },
  ];
  return s;
};
