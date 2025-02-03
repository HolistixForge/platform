import { ReduceArgs, Reducer, SharedMap } from '@monorepo/collab-engine';
import { TProjectMeta } from './core-types';
import { log } from '@monorepo/log';
import { inSeconds, isPassed } from '@monorepo/simple-types';
import { runScript } from '../run-script';
import { toGanymede } from '../build-collab';

import { CONFIG } from '../config';

/**
 *
 */

const GATEWAY_INACIVITY_SHUTDOWN_DELAY = 3000; // secondes

let shouldIBeDead = false;

//

type ReducedEvents = { type: string };

type Ra<T> = ReduceArgs<
  TNotebookSharedData,
  T,
  undefined,
  Record<string, never>
>;

const eventFilter = [
  'activity',
  'periodic',
  'server-watchdog',
  'server-map-http-service',
  'user-leave',
];

export class MetaReducer extends Reducer<
  TNotebookSharedData,
  ReducedEvents,
  undefined,
  Record<string, never>
> {
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    if (!eventFilter.includes(g.event.type)) {
      updateProjectMetaActivity(g.sd.meta);
    }

    if (g.event.type === 'periodic') {
      const meta = g.sd.meta.get('meta');
      if (meta) {
        const gateway_shutdown = new Date(
          meta.projectActivity.gateway_shutdown
        );
        if (isPassed(gateway_shutdown)) {
          if (shouldIBeDead === false) {
            log(6, 'GATEWAY', 'shutdown');
            // call ganymede "gateway stop" api endpoint
            toGanymede({
              url: '/gateway-stop',
              method: 'POST',
              headers: { authorization: CONFIG.GATEWAY_TOKEN },
            });
            runScript('reset-gateway');
            shouldIBeDead = true;
          } else {
            log(6, 'GATEWAY', 'shutdown failed process still alive');
          }
        }
      }
    }

    return Promise.resolve();
  }
}

export const updateProjectMetaActivity = (
  meta: SharedMap<TProjectMeta>,
  last?: Date
) => {
  if (!last) last = new Date();
  const previous = meta.get('meta');

  const prevLast = new Date(previous?.projectActivity.last_activity);

  if (!previous || prevLast.getTime() < last.getTime()) {
    log(6, 'META', `last project activity: ${last.toISOString()}`);
    meta.set('meta', {
      ...previous,
      projectActivity: {
        last_activity: last.toISOString(),
        gateway_shutdown: inSeconds(
          GATEWAY_INACIVITY_SHUTDOWN_DELAY,
          last
        ).toISOString(),
      },
    });
  }
};
