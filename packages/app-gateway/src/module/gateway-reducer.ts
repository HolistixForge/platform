import { EPriority, log } from '@holistix-forge/log';
import { inSeconds, isPassed } from '@holistix-forge/simple-types';
import { TEventPeriodic, RequestData } from '@holistix-forge/reducers';
import { TCollabBackendExports, ReducerWithCollab } from '@holistix-forge/collab';
import type { TGatewayExports, TGatewaySharedData } from '@holistix-forge/gateway';
import type {
  TGatewayEvents,
  TEventLoad,
  TEventDisableShutdown,
} from '@holistix-forge/gateway';
import { shutdownGateway } from '../initialization/gateway-init';
import { runScript } from './module';

type TGatewayMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
    disable_gateway_shutdown: boolean;
  };
};

/**
 *
 */

export const GATEWAY_INACIVITY_SHUTDOWN_DELAY = 300; // secondes

let shouldIBeDead = false;

type RequiredExports = {
  collab: TCollabBackendExports;
  gateway: TGatewayExports;
};

export class GatewayReducer extends ReducerWithCollab<TGatewayEvents | TEventPeriodic, TGatewaySharedData> {
  constructor(depsExports: RequiredExports) {
    super(depsExports.collab.registry, 'gateway');
  }

  //

  override reduce(event: TGatewayEvents | TEventPeriodic, requestData: RequestData): Promise<void> {
    this.rearmGatewayTimer(event, requestData);

    switch (event.type) {
      case 'gateway:load':
        return this._load(event, requestData);
      case 'reducers:periodic':
        return this._periodic(event, requestData);
      case 'gateway:disable-shutdown':
        return this._disableGatewayShutdown(event, requestData);
    }
    return Promise.resolve();
  }

  //

  async _load(event: TEventLoad, requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const meta = collab.sharedData['gateway:gateway'].get('unique');
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

    collab.sharedData['gateway:gateway'].set('unique', newMeta);
    return Promise.resolve();
  }

  //

  rearmGatewayTimer = (event: { type: string }, requestData: RequestData) => {
    const collab = this.getCollab(requestData);
    const now = new Date();

    const curMeta = collab.sharedData['gateway:gateway'].get('unique');

    const prevLast = new Date(curMeta?.projectActivity.last_activity || '');

    if (prevLast.getTime() < now.getTime()) {
      log(
        EPriority.Info,
        'META',
        `last project activity: ${now.toISOString()}`
      );

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

      collab.sharedData['gateway:gateway'].set('unique', newMeta);
    }
  };

  //

  async _periodic(event: TEventPeriodic, requestData: RequestData): Promise<void> {
    const collab = this.getCollab(requestData);
    const meta = collab.sharedData['gateway:gateway'].get('unique');
    if (meta) {
      if (!meta.projectActivity.disable_gateway_shutdown) {
        const gateway_shutdown = new Date(
          meta.projectActivity.gateway_shutdown
        );
        if (isPassed(gateway_shutdown)) {
          if (shouldIBeDead === false) {
            log(EPriority.Info, 'GATEWAY', 'shutdown');
            await shutdownGateway();
            await runScript('reset-gateway');
            shouldIBeDead = true;
          } else {
            log(
              EPriority.Info,
              'GATEWAY',
              'shutdown failed process still alive'
            );
          }
        }
      }
    }
    return Promise.resolve();
  }

  _disableGatewayShutdown(event: TEventDisableShutdown, requestData: RequestData): Promise<void> {
    const collab = this.getCollab(requestData);
    const meta = collab.sharedData['gateway:gateway'].get('unique');
    if (meta) {
      meta.projectActivity.disable_gateway_shutdown = true;
      collab.sharedData['gateway:gateway'].set('unique', meta);
    }
    return Promise.resolve();
  }
}
