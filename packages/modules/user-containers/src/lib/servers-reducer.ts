import { TJwtUserContainer } from '@monorepo/demiurge-types';
import { secondAgo } from '@monorepo/simple-types';
import { ForbiddenException, NotFoundException } from '@monorepo/log';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
} from '@monorepo/core-graph';
import { TEventLoad, TGatewayExports } from '@monorepo/gateway';
import {
  Reducer,
  RequestData,
  TReducersBackendExports,
  TEventPeriodic,
} from '@monorepo/reducers';
import { TCollabBackendExports } from '@monorepo/collab';

import { TUserContainersSharedData } from './servers-shared-model';
import { TUserContainer } from './servers-types';
import {
  TEventNew,
  TEventWatchdog,
  TEventActivity,
  TUserContainersEvents,
  TEventMapHttpService,
  TEventDelete,
} from './servers-events';
import { TOAuthClient } from './container-image';
import { TUserContainersExports } from '..';
import { SharedMap } from '@monorepo/collab-engine';

//

type TRequired = {
  collab: TCollabBackendExports<TUserContainersSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
  'user-containers': TUserContainersExports;
};

export class UserContainersReducer extends Reducer<
  TUserContainersEvents | TEventLoad | TEventPeriodic
> {
  //

  constructor(private readonly depsExports: TRequired) {
    super();
  }

  reduce(
    event: TUserContainersEvents | TEventLoad | TEventPeriodic,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'gateway:load':
        // TODO start polling state through runner API ?
        return Promise.resolve();

      case 'user-container:new':
        return this._new(event, requestData);
      case 'user-container:delete':
        return this._delete(event, requestData);
      case 'user-container:watchdog':
        return this._Watchdog(event, requestData);
      case 'user-container:map-http-service':
        return this._MapHttpService(event, requestData);
      case 'user-container:activity':
        return this._Activity(event, requestData);

      case 'reducers:periodic':
        return this._periodic(event);

      default:
        return Promise.resolve();
    }
  }

  private generateContainerId(): string {
    // Generate unique ID like "uc_abc123xyz"
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `uc_${timestamp}${random}`;
  }

  private async createOAuthClients(
    containerId: string,
    oauthClients?: TOAuthClient[]
  ): Promise<
    { client_id: string; client_secret: string; service_name: string }[]
  > {
    if (!oauthClients) return [];
    throw new Error('Not implemented');
  }

  private async deleteOAuthClients(containerId: string) {
    // TODO: delete OAuth clients from database
  }

  async _new(event: TEventNew, requestData: RequestData) {
    // Get image definition from registry
    const imageDef = this.depsExports['user-containers'].imageRegistry.get(
      event.imageId
    );

    if (!imageDef) {
      throw new Error(`Image ${event.imageId} not found in registry`);
    }

    // Generate container ID (string instead of database ID)
    const containerId = this.generateContainerId();

    // Create container in shared state (not database)
    const container: TUserContainer = {
      user_container_id: containerId,
      container_name: event.containerName,
      image_id: imageDef.imageId,
      runner: { type: 'none' },
      oauth: await this.createOAuthClients(containerId, imageDef.oauthClients),
      ip: undefined,
      httpServices: [],
      last_watchdog_at: null,
      last_activity: null,
      system: undefined,
      created_at: new Date().toISOString(),
    };

    // Store in shared state
    this.depsExports.collab.collab.sharedData['user-containers:containers'].set(
      containerId,
      container
    );

    // Create graph node
    const e: TEventNewNode = {
      type: 'core:new-node',
      nodeData: {
        id: userContainerNodeId(containerId),
        name: event.containerName,
        type: 'user-container',
        root: true,
        data: {
          container_id: containerId,
        },
        connectors: [],
      },
      edges: [],
      origin: event.origin,
    };

    this.depsExports.reducers.processEvent(e, requestData);

    // Pass container to following reducers
    event.result = {
      userContainer: container,
    };
  }

  //

  async _Watchdog(event: TEventWatchdog, requestData: RequestData) {
    const jwt = requestData.jwt as TJwtUserContainer;
    const containerId = jwt.user_container_id;
    if (containerId) {
      const s =
        this.depsExports.collab.collab.sharedData[
          'user-containers:containers'
        ].get(containerId);
      if (s) {
        this.depsExports.collab.collab.sharedData[
          'user-containers:containers'
        ].set(containerId, {
          ...s,
          last_watchdog_at: new Date().toISOString(),
          system: event.system,
        });
      }
    }
  }

  //

  async _Activity(event: TEventActivity, requestData: RequestData) {
    const jwt = requestData.jwt as TJwtUserContainer;
    const containerId = jwt.user_container_id;
    if (containerId) {
      const s =
        this.depsExports.collab.collab.sharedData[
          'user-containers:containers'
        ].get(containerId);
      if (s) {
        this.depsExports.collab.collab.sharedData[
          'user-containers:containers'
        ].set(containerId, {
          ...s,
          last_activity: event.last_activity,
        });
      }
    }
  }

  //

  async _MapHttpService(event: TEventMapHttpService, requestData: RequestData) {
    const jwt = requestData.jwt as TJwtUserContainer;
    const containerId = jwt.user_container_id;

    if (!containerId) throw new ForbiddenException();

    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];

    const s = sduc.get(containerId);
    if (!s) throw new NotFoundException();

    const httpServices = [...s.httpServices];

    if (
      !httpServices.find(
        (service) => service.name === event.name && service.port === event.port
      )
    ) {
      // for jupyter stories with a local jupyterlab container
      if (this.depsExports.gateway.gatewayFQDN === '127.0.0.1') {
        httpServices.push({
          host: this.depsExports.gateway.gatewayFQDN,
          name: event.name,
          port: event.port,
          secure: false,
        });
      } else {
        httpServices.push({
          host: this.depsExports.gateway.gatewayFQDN,
          name: event.name,
          port: event.port,
          secure: true,
        });
      }

      sduc.set(containerId, {
        ...s,
        httpServices,
      });

      await this._updateNginx(sduc);
    }
  }

  //

  async _updateNginx(sduc: SharedMap<TUserContainer>) {
    const locations: { host: string; ip: string; port: number }[] = [];
    sduc.forEach((container) => {
      if (container.ip) {
        container.httpServices.forEach((hs) => {
          locations.push({
            host: hs.host,
            ip: container.ip as string,
            port: hs.port,
          });
        });
      }
    });
    this.depsExports.gateway.updateReverseProxy(locations);
  }

  //

  async _periodic(event: TEventPeriodic) {
    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];
    // remove declared http services for container that did not
    // sent watchdog event for 30 secondes (down)
    sduc.forEach((container) => {
      if (
        container.httpServices.length > 0 &&
        (!container.last_watchdog_at ||
          secondAgo(container.last_watchdog_at, event.date) > 30)
      ) {
        sduc.set(container.user_container_id, {
          ...container,
          httpServices: [],
        });
      }
    });
    this._updateNginx(sduc);
  }

  //

  async _delete(event: TEventDelete, requestData: RequestData) {
    const containerId = event.user_container_id;
    await this.deleteOAuthClients(containerId);

    this.depsExports.collab.collab.sharedData[
      'user-containers:containers'
    ].delete(containerId);
    const id = userContainerNodeId(containerId);

    const e: TEventDeleteNode = {
      type: 'core:delete-node',
      id,
    };

    this.depsExports.reducers.processEvent(e, requestData);
  }

  //
}

export const userContainerNodeId = (user_container_id: string) =>
  `user-container:${user_container_id}`;
