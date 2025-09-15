import { ReduceArgs, Reducer, SharedMap } from '@monorepo/collab-engine';
import { log } from '@monorepo/log';
import { inSeconds, isPassed } from '@monorepo/simple-types';
import { TGatewayExtraContext } from '@monorepo/gateway';

import { TCoreSharedData } from './core-shared-model';
import { TProjectMeta } from './core-types';

/**
 *
 */

export const GATEWAY_INACIVITY_SHUTDOWN_DELAY = 300; // secondes

let shouldIBeDead = false;

//

type ReducedEvents = { type: string };

type Ra<T> = ReduceArgs<
  TCoreSharedData,
  T,
  Record<string, never>,
  Record<string, never>,
  TGatewayExtraContext
>;

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
  Record<string, never>,
  Record<string, never>,
  TGatewayExtraContext
> {
  //



  reduce(g: Ra<ReducedEvents>): Promise<void> {
    if (!eventFilter.includes(g.event.type)) {
      rearmGatewayTimer(g.sd.meta);
    }

    if (g.event.type === 'periodic') {
      const meta = g.sd.meta.get('meta');
      if (meta) {
        if (!meta.projectActivity.disable_gateway_shutdown) {
          const gateway_shutdown = new Date(
            meta.projectActivity.gateway_shutdown
          );
          if (isPassed(gateway_shutdown)) {
            if (shouldIBeDead === false) {
              log(6, 'GATEWAY', 'shutdown');
              g.extraContext.gateway.gatewayStopNotify();
              shouldIBeDead = true;
            } else {
              log(6, 'GATEWAY', 'shutdown failed process still alive');
            }
          }
        }
      }
    }

    if (g.event.type === 'core:disable-gateway-shutdown') {
      const meta = g.sd.meta.get('meta')
      if (meta) {
        meta.projectActivity.disable_gateway_shutdown = true;
        g.sd.meta.set('meta', meta);
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
        disable_gateway_shutdown: curMeta.projectActivity.disable_gateway_shutdown,
      },
    });
  }
};
