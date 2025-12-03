import { EPriority, log } from '@holistix/log';
import { inSeconds, isPassed } from '@holistix/simple-types';
import { Reducer, TEventPeriodic } from '@holistix/reducers';
import { TCollabBackendExports } from '@holistix/collab';
import type { TGatewayExports, TGatewaySharedData } from '@holistix/gateway';
import type {
  TGatewayEvents,
  TEventLoad,
  TEventDisableShutdown,
} from '@holistix/gateway';
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
  collab: TCollabBackendExports<TGatewaySharedData>;
  gateway: TGatewayExports;
};

export class GatewayReducer extends Reducer<TGatewayEvents | TEventPeriodic> {
  private depsExports: RequiredExports;

  constructor(depsExports: RequiredExports) {
    super();
    this.depsExports = depsExports;
  }

  //

  override reduce(event: TGatewayEvents | TEventPeriodic): Promise<void> {
    this.rearmGatewayTimer(event);

    switch (event.type) {
      case 'gateway:load':
        return this._load(event);
      case 'reducers:periodic':
        return this._periodic(event);
      case 'gateway:disable-shutdown':
        return this._disableGatewayShutdown(event);
    }
    return Promise.resolve();
  }

  //

  async _load(event: TEventLoad) {
    const meta =
      this.depsExports.collab.collab.sharedData['gateway:gateway'].get(
        'unique'
      );
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

    this.depsExports.collab.collab.sharedData['gateway:gateway'].set(
      'unique',
      newMeta
    );
    return Promise.resolve();
  }

  //

  rearmGatewayTimer = (event: { type: string }) => {
    const now = new Date();

    const curMeta =
      this.depsExports.collab.collab.sharedData['gateway:gateway'].get(
        'unique'
      );

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

      this.depsExports.collab.collab.sharedData['gateway:gateway'].set(
        'unique',
        newMeta
      );
    }
  };

  //

  async _periodic(event: TEventPeriodic): Promise<void> {
    const meta =
      this.depsExports.collab.collab.sharedData['gateway:gateway'].get(
        'unique'
      );
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

  _disableGatewayShutdown(event: TEventDisableShutdown): Promise<void> {
    const meta =
      this.depsExports.collab.collab.sharedData['gateway:gateway'].get(
        'unique'
      );
    if (meta) {
      meta.projectActivity.disable_gateway_shutdown = true;
      this.depsExports.collab.collab.sharedData['gateway:gateway'].set(
        'unique',
        meta
      );
    }
    return Promise.resolve();
  }
}
