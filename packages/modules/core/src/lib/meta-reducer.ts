import { ReduceArgs, Reducer, SharedMap } from '@monorepo/collab-engine';
import { log } from '@monorepo/log';
import { inSeconds, isPassed } from '@monorepo/simple-types';

import { TCoreSharedData } from './core-shared-model';
import { TProjectMeta } from './core-types';

/**
 *
 */

const GATEWAY_INACIVITY_SHUTDOWN_DELAY = 3000; // secondes

let shouldIBeDead = false;

//

type ReducedEvents = { type: string };

type Ra<T> = ReduceArgs<TCoreSharedData, T, undefined, Record<string, never>>;

// TODO_DEM: timer and events system
const eventFilter = [
  'activity',
  'periodic',
  'server-watchdog',
  'server-map-http-service',
  'user-leave',
];

export class MetaReducer extends Reducer<
  TCoreSharedData,
  ReducedEvents,
  undefined,
  Record<string, never>
> {
  //

  gatewayStopNotify: () => Promise<void>;

  constructor(gatewayStopNotify: () => Promise<void>) {
    super();
    this.gatewayStopNotify = gatewayStopNotify;
  }

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    if (!eventFilter.includes(g.event.type)) {
      rearmGatewayTimer(g.sd.meta);
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
            this.gatewayStopNotify();
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

const rearmGatewayTimer = (meta: SharedMap<TProjectMeta>, last?: Date) => {
  if (!last) last = new Date();
  const curMeta = meta.get('meta') as TProjectMeta;

  const prevLast = new Date(curMeta.projectActivity.last_activity);

  if (!curMeta || prevLast.getTime() < last.getTime()) {
    log(6, 'META', `last project activity: ${last.toISOString()}`);
    meta.set('meta', {
      ...curMeta,
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
