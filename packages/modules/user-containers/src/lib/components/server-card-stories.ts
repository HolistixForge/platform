import { UseContainerProps } from './node-server/node-server';

export type StoryArgs = UseContainerProps;

export const makeStoryArgs = (): StoryArgs => ({
  container: {
    user_container_id: '1',
    container_name: 'My Super Server',
    image_id: '1',
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

/**
 * A container already running on the platform.
 *
 * The runner row stays on the card whichever runner is active, so that moving
 * a service between a laptop and the platform does not mean deleting it and
 * making another one. This story is the state that used to render nothing.
 */
export const runningOnPlatformStory = (): StoryArgs => {
  const args = withServicesStory();
  args.container.runner = {
    id: 'platform',
    host: 'platform-host-1',
    engine: 'docker',
    runtime: 'kata',
    isolation: 'microvm',
    concessions: [],
  };
  return args;
};

/**
 * The same placement on a Mac host — a VM per container, and five controls the
 * engine cannot express.
 *
 * The card has to distinguish this from the story above. Both are microVMs and
 * they are not the same guarantee, which is why the concessions are listed
 * rather than folded into "own kernel".
 */
export const runningOnAppleStory = (): StoryArgs => {
  const args = withServicesStory();
  args.container.runner = {
    id: 'platform',
    host: 'mac-host-1',
    engine: 'apple',
    runtime: 'container-runtime-linux',
    isolation: 'microvm',
    concessions: [
      'no-new-privileges',
      'pids-cgroup',
      'restart-policy',
      'run-may-pull',
      'no-hot-network-attach',
    ],
  };
  return args;
};

/**
 * The state this whole line exists for: a container on the host's own kernel,
 * beside every other tenant.
 *
 * It is reachable — `BROKER_RUNTIME=runc` is a stated choice, not a fallback —
 * and a card that looked identical to the microVM one would be the silent
 * failure the "no default runtime" rule was written to prevent.
 */
export const runningOnSharedKernelStory = (): StoryArgs => {
  const args = withServicesStory();
  args.container.runner = {
    id: 'platform',
    host: 'platform-host-1',
    engine: 'docker',
    runtime: 'runc',
    isolation: 'shared-kernel',
    concessions: [],
  };
  return args;
};

/**
 * The same container on the local runner, which also hands back the command to
 * paste — so the card shows both the choice and the command.
 *
 * The command is the real shape and not an elided one. A local placement's
 * `--add-host` flags carry a UUID and a domain, and `SETTINGS` is a base64
 * blob; the whole line runs to several hundred characters with no space a
 * browser is willing to break at. Shortened to a tidy example, the story
 * rendered fine while the product drew the command straight off the card and
 * across the board.
 *
 * `user_id` and `machine_id` because "local" is neither one place nor one
 * person — the type says both are carried, and the host avatar on the card is
 * read from `user_id`.
 */
export const runningLocallyStory = (): StoryArgs => {
  const args = withServicesStory();
  args.container.runner = {
    id: 'local',
    user_id: 'b3f5c1a2-0d4e-4f6a-9c8b-7e2d1a0f5c34',
    machine_id: 'm-9f2c1b',
    command:
      'docker run --add-host=org-5b927daf-4ca8-45a7-adbe-32bce35988f7.apollo.test:host-gateway ' +
      '--add-host=ganymede.apollo.test:host-gateway --restart unless-stopped ' +
      '--name holistix_notebook_uc_msiod -e SETTINGS=eyJ1c2VyX2NvbnRhaW5lcl9pZCI6' +
      'IjRkNDQxNy00ZmRmLWJhZDgtZmY5MmMwNTNlZTQzIiwiZ2F0ZXdheSI6Imh0dHBzOi8vb3JnLTVi' +
      'OTI3ZGFmLmFwb2xsby50ZXN0In0= holistixforge/ubuntu-terminal:24.04',
  };
  return args;
};
