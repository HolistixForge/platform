import {
  ReduceArgs,
  Reducer,
  TCollabNativeEvent,
  TEventPeriodic,
} from '@monorepo/collab-engine';
import { TJwtServer, TJwtUser } from '@monorepo/demiurge-types';
import { secondAgo } from '@monorepo/simple-types';
import { ForbiddenException, NotFoundException } from '@monorepo/log';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
  TEventLoad,
} from '@monorepo/core-graph';
import { TGraphNode, TOAuthClient } from '@monorepo/module';
import { TGatewayExtraContext } from '@monorepo/gateway';

import { TServersSharedData } from './servers-shared-model';
import { TServer } from './servers-types';
import {
  TEventNewServer,
  TEventDeleteServer,
  TEventServerWatchdog,
  TEventServerActivity,
  TEventServerMapHttpService,
  TServerEvents,
  TEventHostServer,
  TEventServerToCloud,
  TEventServerCloudPause,
  TEventServerCloudStart,
  TEventServerCloudDelete,
} from './servers-events';
import { TUserContainersExtraContext } from '..';

/**
 *
 */

type TExtraArgs = {
  authorizationHeader: string; // used for all ganymede calls
  jwt: TJwtServer | TJwtUser; // used for: map http service, server watchdog, server activity
  ip: string; // used for: map http service, server watchdog
};

type ReducedEvents = TServerEvents | TCollabNativeEvent | TEventLoad;

type DispatchedEvents = TEventNewNode | TEventDeleteNode | TEventNewServer;

type UsedSharedData = TCoreSharedData & TServersSharedData;

//

type TExtraContext = TGatewayExtraContext & TUserContainersExtraContext;

//

type Ra<T> = ReduceArgs<
  UsedSharedData,
  T,
  DispatchedEvents,
  TExtraArgs,
  TExtraContext
>;

//

type Turp = (
  locations: { location: string; ip: string; port: number }[]
) => Promise<void>;

export class ServersReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TExtraArgs,
  TExtraContext
> {
  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'core:load':
        // TODO start polling state through runner API ?
        return Promise.resolve();

      case 'user-container:new':
        return this._newServer(g as Ra<TEventNewServer>);
      case 'user-container:delete':
        return this._deleteServer(g as Ra<TEventDeleteServer>);
      case 'periodic':
        return this._periodic(g as Ra<TEventPeriodic>);
      case 'server:watchdog':
        return this._serverWatchdog(g as Ra<TEventServerWatchdog>);
      case 'server:map-http-service':
        return this._serverMapHttpService(g as Ra<TEventServerMapHttpService>);
      case 'user-container:activity':
        return this._serverActivity(g as Ra<TEventServerActivity>);
      case 'user-container:host':
        return this._hostServer(g as Ra<TEventHostServer>);
      case 'user-container:to-cloud':
        return this._serverToCloud(g as Ra<TEventServerToCloud>);
      case 'user-container:cloud-pause':
        return this._serverCloudPause(g as Ra<TEventServerCloudPause>);
      case 'user-container:cloud-start':
        return this._serverCloudStart(g as Ra<TEventServerCloudStart>);
      case 'user-container:cloud-delete':
        return this._serverCloudDelete(g as Ra<TEventServerCloudDelete>);

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

  private checkUserGrants(
    g: Ra<unknown>,
    containerId: string,
    requiredGrants: string[]
  ): void {
    const jwt = g.extraArgs.jwt as TJwtUser;

    // Check if user has required grants for this container
    const userGrants = jwt.grants || [];
    const hasRequiredGrants = requiredGrants.every(
      (grant: string) => userGrants.includes(grant) || userGrants.includes('*')
    );

    if (!hasRequiredGrants) {
      throw new ForbiddenException([
        {
          message: `Insufficient grants. Required: ${requiredGrants.join(
            ', '
          )}`,
        },
      ]);
    }
  }

  private async createOAuthClients(
    containerId: string,
    oauthClients: TOAuthClient[],
    g: Ra<unknown>
  ): Promise<{ client_id: string; client_secret: string }[]> {
    const createdClients = [];

    for (const client of oauthClients) {
      const response = await g.extraContext.gateway.toGanymede<{
        client_id: string;
        client_secret: string;
      }>({
        url: '/oauth/clients',
        method: 'POST',
        jsonBody: {
          service_name: client.serviceName,
          user_container_id: containerId, // Use string ID
          access_token_lifetime: client.accessTokenLifetime,
          redirect_uris: client.redirectUris,
        },
        headers: { authorization: 'TODO_USE_GATEWAY_TOKEN' },
      });

      createdClients.push({
        client_id: response.client_id,
        client_secret: response.client_secret,
      });
    }

    return createdClients;
  }

  async _newServer(g: Ra<TEventNewServer>) {
    if (!g.event.from.new) {
      throw new Error('New server event without from.new');
    }

    // Get image definition from registry
    const imageDef = g.extraContext.userContainers.imageRegistry.get(
      g.event.from.new?.imageId
    );

    if (!imageDef) {
      throw new Error(
        `Image ${g.event.from.new?.imageId} not found in registry`
      );
    }

    // Generate container ID (string instead of database ID)
    const containerId = this.generateContainerId();

    // Create container in shared state (not database)
    const container: TServer = {
      user_container_id: containerId,
      server_name: g.event.from.new.serverName,
      image_id: 0, // Not used anymore
      host_user_id: null,
      location: 'hosted', // Always hosted now
      type: imageDef.options.containerType, // From registry, not hardcoded!
      oauth: [], // Will be populated by OAuth client creation

      // Runtime state
      ip: undefined,
      httpServices: [],
      last_watchdog_at: null,
      last_activity: null,
      system: undefined,

      // Metadata
      created_at: new Date().toISOString(),
    };

    // Create OAuth clients in database if defined in image
    let oauthClients: { client_id: string; client_secret: string }[] = [];
    if (imageDef.options.oauthClients) {
      oauthClients = await this.createOAuthClients(
        containerId,
        imageDef.options.oauthClients,
        g
      );
    }

    // Update container with OAuth client data
    container.oauth = oauthClients.map((client) => ({
      service_name: client.client_id.split('_')[2], // Extract service name from client_id
      client_id: client.client_id,
      client_secret: client.client_secret,
    }));

    // Store in shared state
    g.sd.projectServers.set(containerId, container);

    // Create graph node
    const node: TGraphNode = {
      id: `user-container:${containerId}`,
      name: g.event.from.new.serverName,
      type: 'server', // Keep as 'server' for now, will rename later
      root: true,
      data: {},
      connectors: [],
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: node,
      edges: [],
      origin: g.event.origin,
    });

    // Pass container to following reducers
    g.event.result = {
      server: container,
    };
  }

  //

  async _serverWatchdog(g: Ra<TEventServerWatchdog>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const containerId = jwt.user_container_id;
    if (containerId) {
      const s = g.sd.projectServers.get(containerId);
      if (s) {
        g.sd.projectServers.set(containerId, {
          ...s,
          last_watchdog_at: new Date().toISOString(),
          ip: g.extraArgs.ip,
          host_user_id:
            g.event.host_user_id === 'null' ? null : g.event.host_user_id,
          system: g.event.system,
        });
      }
    }
  }

  //

  async _serverActivity(g: Ra<TEventServerActivity>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const containerId = jwt.user_container_id;
    if (containerId) {
      const s = g.sd.projectServers.get(containerId);
      if (s) {
        g.sd.projectServers.set(containerId, {
          ...s,
          last_activity: g.event.last_activity,
        });
      }
    }
  }

  //

  async _hostServer(g: Ra<TEventHostServer>) {
    const containerId = g.event.user_container_id;
    if (containerId) {
      const s = g.sd.projectServers.get(containerId);
      if (s) {
        s.host_user_id =
          g.extraArgs.jwt.type === 'access_token'
            ? g.extraArgs.jwt.user.id
            : null;

        g.sd.projectServers.set(containerId, s);
      }
    }
  }

  async _serverToCloud(g: Ra<TEventServerToCloud>) {
    const { user_container_id: containerId, instanceType, storage } = g.event;
    if (containerId) {
      this.checkUserGrants(g, containerId, [
        'container:manage',
        'container:cloud',
      ]);

      const s = g.sd.projectServers.get(containerId);
      if (s) {
        s.location = 'cloud';
        g.sd.projectServers.set(containerId, s);
        // TODO start polling state
      }
    }
  }

  //

  async _serverCloudPause(g: Ra<TEventServerCloudPause>) {
    const { user_container_id: containerId } = g.event;
    if (containerId) {
      this.checkUserGrants(g, containerId, [
        'container:manage',
        'container:cloud',
      ]);

      const s = g.sd.projectServers.get(containerId);
      if (s) {
        // TODO pause server
      }
    }
  }

  //

  async _serverCloudStart(g: Ra<TEventServerCloudStart>) {
    const { user_container_id: containerId } = g.event;
    if (containerId) {
      this.checkUserGrants(g, containerId, [
        'container:manage',
        'container:cloud',
      ]);

      const s = g.sd.projectServers.get(containerId);
      if (s) {
        // TODO start server, and start polling state
      }
    }
  }

  //

  async _serverCloudDelete(g: Ra<TEventServerCloudDelete>) {
    const { user_container_id: containerId } = g.event;
    if (containerId) {
      this.checkUserGrants(g, containerId, [
        'container:manage',
        'container:delete',
      ]);

      const s = g.sd.projectServers.get(containerId);
      if (s) {
        // TODO delete server resources
        // TODO stop polling state
      }
    }
  }

  //

  async _serverMapHttpService(g: Ra<TEventServerMapHttpService>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const containerId = jwt.user_container_id;

    if (!containerId) throw new ForbiddenException();

    const s = g.sd.projectServers.get(containerId);
    if (!s) throw new NotFoundException();

    const httpServices = [...s.httpServices];

    if (
      !httpServices.find(
        (service) =>
          service.name === g.event.name && service.port === g.event.port
      )
    ) {
      // for jupyter stories with a local jupyterlab container
      if (g.extraContext.gateway.gatewayFQDN === '127.0.0.1') {
        httpServices.push({
          host: g.extraContext.gateway.gatewayFQDN,
          name: g.event.name,
          port: g.event.port,
          location: '',
          secure: false,
        });
      } else {
        httpServices.push({
          host: g.extraContext.gateway.gatewayFQDN,
          name: g.event.name,
          port: g.event.port,
          location: `${containerId}/${g.event.name}`,
          secure: true,
        });
      }

      g.sd.projectServers.set(containerId, {
        ...s,
        httpServices,
      });

      await this._updateNginx(g.sd, g.extraContext.gateway.updateReverseProxy);
    }
  }

  //

  async _updateNginx(sd: UsedSharedData, updateReverseProxy: Turp) {
    const locations: { location: string; ip: string; port: number }[] = [];
    sd.projectServers.forEach((server) => {
      if (server.ip) {
        server.httpServices.forEach((hs) => {
          locations.push({
            location: hs.location,
            ip: server.ip as string,
            port: hs.port,
          });
        });
      }
    });
    updateReverseProxy(locations);
  }

  //

  async _periodic(g: Ra<TEventPeriodic>) {
    // remove declared http services for server that did not
    // sent watchdog event for 30 secondes (down)
    g.sd.projectServers.forEach((server) => {
      if (
        server.httpServices.length > 0 &&
        (!server.last_watchdog_at ||
          secondAgo(server.last_watchdog_at, g.event.date) > 30)
      ) {
        g.sd.projectServers.set(`${server.user_container_id}`, {
          ...server,
          httpServices: [],
        });
      }
    });
    this._updateNginx(g.sd, g.extraContext.gateway.updateReverseProxy);
  }

  //

  async _deleteServer(g: Ra<TEventDeleteServer>) {
    const containerId = g.event.user_container_id;
    await g.extraContext.gateway.toGanymede({
      url: 'oauth/clients',
      method: 'DELETE',
      pathParameters: {
        user_container_id: containerId,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    g.sd.projectServers.delete(containerId);
    const id = projectServerNodeId(containerId);

    g.bep.process({ type: 'core:delete-node', id });
  }

  //
}

export const projectServerNodeId = (user_container_id: string) =>
  `user-container:${user_container_id}`;
