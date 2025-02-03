import {
  TServerComponentCallbacks,
  TServerComponentProps,
} from '@monorepo/demiurge-types';
import { sleep } from '../../storybook-utils';
import { useEffect, useState } from 'react';
import { randomGuy } from '../../utils/random-guys';

//

const ni = async function (): Promise<void> {
  await sleep(3);
  throw new Error('Function not implemented.');
};

//

export const useMockServerBehaviours = (
  props: TServerComponentProps & TServerComponentCallbacks,
): TServerComponentProps & TServerComponentCallbacks => {
  const [state, setState] = useState<TServerComponentProps>(props);

  useEffect(() => setState(props), [props]);

  const cbs = {
    onCloudStart: async () => {
      await sleep(1);
      setState((prev) => ({ ...prev, ec2_instance_state: 'pending' }));
      setTimeout(
        () => setState((prev) => ({ ...prev, ec2_instance_state: 'running' })),
        5000,
      );
    },

    onCloudStop: async () => {
      await sleep(1);
      setState((prev) => ({ ...prev, ec2_instance_state: 'stopping' }));
      setTimeout(
        () => setState((prev) => ({ ...prev, ec2_instance_state: 'stopped' })),
        5000,
      );
    },

    onCloudDelete: async () => {
      await sleep(1);
      setState((prev) => ({
        ...prev,
        ec2_instance_state: null,
        location: 'none',
      }));
    },

    onCopyCommand: props.onCopyCommand
      ? async () => {
          await sleep(1.5);
          return 'docker run -it xxxxxxx ...';
        }
      : undefined,

    onHost: async () => {
      await sleep(1);
      setState((prev) => ({ ...prev, location: 'hosted', host: randomGuy() }));
    },

    onCloud: async () => {
      await sleep(1.5);
      setState((prev) => ({
        ...prev,
        location: 'aws',
        ec2_instance_state: 'allocating',
      }));
      setTimeout(
        () => setState((prev) => ({ ...prev, ec2_instance_state: 'pending' })),
        3000,
      );
      setTimeout(
        () => setState((prev) => ({ ...prev, ec2_instance_state: 'running' })),
        7000,
      );
      setTimeout(
        () => setState((prev) => ({ ...prev, last_watchdog_at: new Date() })),
        9500,
      );
    },

    onDelete: ni,
  };

  return { ...state, ...cbs };
};
