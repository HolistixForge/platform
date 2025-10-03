import { log } from '@monorepo/log';
import { inSeconds, isPassed } from '@monorepo/simple-types';
import { Reducer } from '@monorepo/reducers';
import { TCollabExports } from '@monorepo/collab';
import { TGatewayExports } from '..';

import { TGatewayMeta, TGatewaySharedData } from './gateway-types';
import {
  TGatewayEvents,
  TEventLoad,
  TEventDisableShutdown,
  TEventPeriodic,
} from './gateway-events';

/**
 *
 */

export const GATEWAY_INACIVITY_SHUTDOWN_DELAY = 300; // secondes

let shouldIBeDead = false;

export class GatewayReducer extends Reducer<
  TGatewayEvents,
  TCollabExports<TGatewaySharedData> & { gateway: TGatewayExports }
> {
  //

  override reduce(
    event: TGatewayEvents,
    depsExports: TCollabExports<TGatewaySharedData> & {
      gateway: TGatewayExports;
    }
  ): Promise<void> {
    this.rearmGatewayTimer(event, depsExports);

    switch (event.type) {
      case 'gateway:load':
        return this._load(event, depsExports);
      case 'gateway:periodic':
        return this._periodic(event, depsExports);
      case 'gateway:disable-shutdown':
        return this._disableGatewayShutdown(event, depsExports);
    }
    return Promise.resolve();
  }

  //

  async _load(
    event: TEventLoad,
    depsExports: TCollabExports<TGatewaySharedData>
  ) {
    const meta = depsExports.sharedData['gateway:gateway'].get('unique');
    const disable_gateway_shutdown =
      meta?.projectActivity.disable_gateway_shutdown || false;

    const newMeta = {
      projectActivity: {
        last_activity: new Date().toISOString(),
        gateway_shutdown: inSeconds(
          GATEWAY_INACIVITY_SHUTDOWN_DELAY,
          new Date()
        ).toISOString(),
        disable_gateway_shutdown,
      },
    };

    depsExports.sharedData['gateway:gateway'].set('unique', newMeta);
    return Promise.resolve();
  }

  //

  rearmGatewayTimer = (
    event: { type: string },
    depsExports: TCollabExports<TGatewaySharedData>
  ) => {
    const now = new Date();

    const curMeta = depsExports.sharedData['gateway:gateway'].get('unique');

    const prevLast = new Date(curMeta?.projectActivity.last_activity || '');

    if (prevLast.getTime() < now.getTime()) {
      log(6, 'META', `last project activity: ${now.toISOString()}`);

      const newMeta: TGatewayMeta = {
        ...curMeta,
        projectActivity: {
          last_activity: now.toISOString(),
          gateway_shutdown: inSeconds(
            GATEWAY_INACIVITY_SHUTDOWN_DELAY,
            now
          ).toISOString(),
          disable_gateway_shutdown:
            curMeta?.projectActivity.disable_gateway_shutdown || false,
        },
      };

      depsExports.sharedData['gateway:gateway'].set('unique', newMeta);
    }
  };

  //

  _periodic(
    event: TEventPeriodic,
    depsExports: TCollabExports<TGatewaySharedData> & {
      gateway: TGatewayExports;
    }
  ): Promise<void> {
    const meta = depsExports.sharedData['gateway:gateway'].get('unique');
    if (meta) {
      if (!meta.projectActivity.disable_gateway_shutdown) {
        const gateway_shutdown = new Date(
          meta.projectActivity.gateway_shutdown
        );
        if (isPassed(gateway_shutdown)) {
          if (shouldIBeDead === false) {
            log(6, 'GATEWAY', 'shutdown');
            depsExports.gateway.gatewayStop();
            shouldIBeDead = true;
          } else {
            log(6, 'GATEWAY', 'shutdown failed process still alive');
          }
        }
      }
    }
    return Promise.resolve();
  }

  _disableGatewayShutdown(
    event: TEventDisableShutdown,
    depsExports: TCollabExports<TGatewaySharedData>
  ): Promise<void> {
    const meta = depsExports.sharedData['gateway:gateway'].get('unique');
    if (meta) {
      meta.projectActivity.disable_gateway_shutdown = true;
      depsExports.sharedData['gateway:gateway'].set('unique', meta);
    }
    return Promise.resolve();
  }
}
