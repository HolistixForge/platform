import { TJwtUser } from '@holistix-forge/types';
import { TJwtUserContainer } from './servers-types';
import { secondAgo } from '@holistix-forge/simple-types';
import { ForbiddenException, NotFoundException } from '@holistix-forge/log';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
} from '@holistix-forge/core-graph';
import { TEventLoad, TGatewayExports } from '@holistix-forge/gateway';
import {
  Reducer,
  RequestData,
  TReducersBackendExports,
  TEventPeriodic,
} from '@holistix-forge/reducers';
import { TCollabBackendExports } from '@holistix-forge/collab';
import crypto from 'crypto';

import { TUserContainersSharedData } from './servers-shared-model';
import { TUserContainer } from './servers-types';
import {
  TEventNew,
  TEventWatchdog,
  TEventActivity,
  TUserContainersEvents,
  TEventMapHttpService,
  TEventDelete,
  TEventSelectRunner,
  TEventStart,
} from './servers-events';
import { TOAuthClient } from './container-image';
import { TUserContainersExports } from '..';
import { SharedMap } from '@holistix-forge/collab-engine';

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
      case 'user-container:set-runner':
        return this._setRunner(event, requestData);
      case 'user-container:start':
        return this._start(event, requestData);

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

  /**
   * Generate FQDN for user container
   * Container-aware logic (lives in user-containers module, not gateway/ganymede)
   * @param containerId - Container ID
   * @param organizationId - Organization ID
   * @returns FQDN: uc-{containerId}.org-{orgId}.{domain}
   */
  private generateContainerFQDN(
    containerId: string,
    organizationId: string
  ): string {
    const domain = process.env.DOMAIN || 'domain.local';
    return `uc-${containerId}.org-${organizationId}.${domain}`;
  }

  private async createOAuthClients(
    containerId: string,
    projectId: string,
    oauthClients?: TOAuthClient[]
  ): Promise<
    { client_id: string; client_secret: string; service_name: string }[]
  > {
    if (!oauthClients || oauthClients.length === 0) return [];

    const oauthManager = this.depsExports.gateway.oauthManager;
    const createdClients: {
      client_id: string;
      client_secret: string;
      service_name: string;
    }[] = [];

    for (const oauthClient of oauthClients) {
      // Generate unique client_id and client_secret
      const client_id = crypto.randomUUID();
      const client_secret = crypto.randomUUID();

      // Create OAuth client via OAuthManager
      oauthManager.addClient({
        client_id,
        client_secret,
        project_id: projectId,
        service_name: oauthClient.serviceName,
        redirect_uris: oauthClient.redirectUris || [],
        grants: ['authorization_code', 'refresh_token'],
        created_at: new Date().toISOString(),
      });

      createdClients.push({
        client_id,
        client_secret,
        service_name: oauthClient.serviceName,
      });
    }

    return createdClients;
  }

  private async deleteOAuthClients(containerId: string) {
    const container =
      this.depsExports.collab.collab.sharedData[
        'user-containers:containers'
      ].get(containerId);

    if (!container) return;

    const oauthManager = this.depsExports.gateway.oauthManager;

    // Delete all OAuth clients for this container
    for (const oauthClient of container.oauth) {
      oauthManager.deleteClient(oauthClient.client_id);
    }
  }

  async _new(event: TEventNew, requestData: RequestData) {
    // Extract user_id from JWT (TJwtUser)
    const jwt = requestData.jwt as TJwtUser;
    const user_id = jwt?.user?.id;

    if (!user_id) {
      throw new ForbiddenException([
        { message: 'User authentication required' },
      ]);
    }

    // Check permission: container:create
    const permissionManager = this.depsExports.gateway.permissionManager;
    if (!permissionManager.hasPermission(user_id, 'container:create')) {
      throw new ForbiddenException([
        { message: 'Permission denied: container:create' },
      ]);
    }

    // Get project_id from  event (if available)
    const project_id = event.project_id;
    if (!project_id) {
      throw new ForbiddenException([
        { message: 'Project ID required for container creation' },
      ]);
    }

    // Get image definition from registry
    const imageDef = this.depsExports['user-containers'].imageRegistry.get(
      event.imageId
    );

    if (!imageDef) {
      throw new Error(`Image ${event.imageId} not found in registry`);
    }

    // Generate container ID (string instead of database ID)
    const containerId = this.generateContainerId();

    // Create OAuth clients
    const oauthClients = await this.createOAuthClients(
      containerId,
      project_id,
      imageDef.oauthClients
    );

    // Create container in shared state (not database)
    const container: TUserContainer = {
      user_container_id: containerId,
      container_name: event.containerName,
      image_id: imageDef.imageId,
      runner: { id: 'none' },
      oauth: oauthClients,
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

    // Register DNS entry via DNSManager
    try {
      const orgId = this.depsExports.gateway.organization_id;
      const fqdn = this.generateContainerFQDN(containerId, orgId);
      // Stage 1 Nginx IP (configurable via DEV_CONTAINER_IP env var)
      const stage1NginxIp = process.env.DEV_CONTAINER_IP || '127.0.0.1';

      await this.depsExports.gateway.dnsManager.registerRecord(
        fqdn,
        stage1NginxIp
      );
    } catch (error: any) {
      // Log error but don't fail container creation if DNS registration fails
      // DNS can be registered later if needed
      console.error('Failed to register DNS for container:', error);
    }

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
    // Validate token
    const jwt = requestData.jwt as TJwtUserContainer;
    if (!jwt || jwt.type !== 'user_container_token') {
      throw new ForbiddenException([
        { message: 'Invalid JWT token type for watchdog' },
      ]);
    }

    const containerId = jwt.user_container_id;
    if (!containerId) {
      throw new ForbiddenException([
        { message: 'Container ID required in token' },
      ]);
    }

    // Note: Token validation would need to be implemented in TokenManager
    // For now, we trust the JWT structure

    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];
    const s = sduc.get(containerId);

    if (!s) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    // Update container state
    // Note: IP changes are handled when container reconnects with new IP
    // DNS registration happens at container creation, not here
    sduc.set(containerId, {
      ...s,
      last_watchdog_at: new Date().toISOString(),
      system: event.system,
      // IP might be updated here if provided in event (currently not in TEventWatchdog)
    });
  }

  //

  async _Activity(event: TEventActivity, requestData: RequestData) {
    // Validate token
    const jwt = requestData.jwt as TJwtUserContainer;
    if (!jwt || jwt.type !== 'user_container_token') {
      throw new ForbiddenException([
        { message: 'Invalid JWT token type for activity' },
      ]);
    }

    const containerId = jwt.user_container_id;
    if (!containerId) {
      throw new ForbiddenException([
        { message: 'Container ID required in token' },
      ]);
    }

    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];
    const s = sduc.get(containerId);

    if (!s) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    sduc.set(containerId, {
      ...s,
      last_activity: event.last_activity,
    });
  }

  //

  async _MapHttpService(event: TEventMapHttpService, requestData: RequestData) {
    // Validate token
    const jwt = requestData.jwt as TJwtUserContainer;
    if (!jwt || jwt.type !== 'user_container_token') {
      throw new ForbiddenException([
        { message: 'Invalid JWT token type for map-http-service' },
      ]);
    }

    const containerId = jwt.user_container_id;
    if (!containerId) {
      throw new ForbiddenException([
        { message: 'Container ID required in token' },
      ]);
    }

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
    // With distinct FQDNs, we route: uc-{uuid}.org-{uuid}.domain.local → VPN IP:port
    // Each container's httpServices contain the FQDN in "host" field
    const services: { host: string; ip: string; port: number }[] = [];
    sduc.forEach((container) => {
      if (container.ip) {
        container.httpServices.forEach((hs) => {
          services.push({
            host: hs.host, // FQDN: uc-{uuid}.org-{uuid}.domain.local
            ip: container.ip as string,
            port: hs.port,
          });
        });
      }
    });
    this.depsExports.gateway.updateReverseProxy(services);
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
    // Extract user_id from JWT (TJwtUser)
    const jwt = requestData.jwt as TJwtUser;
    const user_id = jwt?.user?.id;

    if (!user_id) {
      throw new ForbiddenException([
        { message: 'User authentication required' },
      ]);
    }

    const containerId = event.user_container_id;

    // Get container to check ownership (if tracking created_by_user_id)
    const container =
      this.depsExports.collab.collab.sharedData[
        'user-containers:containers'
      ].get(containerId);

    if (!container) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    // Check permission: container:delete
    const permissionManager = this.depsExports.gateway.permissionManager;
    if (!permissionManager.hasPermission(user_id, 'container:delete')) {
      throw new ForbiddenException([
        { message: 'Permission denied: container:delete' },
      ]);
    }

    // Delete OAuth clients
    await this.deleteOAuthClients(containerId);

    // Deregister DNS entry via DNSManager
    try {
      const orgId = this.depsExports.gateway.organization_id;
      const fqdn = this.generateContainerFQDN(containerId, orgId);

      await this.depsExports.gateway.dnsManager.deregisterRecord(fqdn);
    } catch (error: any) {
      // Log error but continue with deletion
      console.error('Failed to deregister DNS for container:', error);
    }

    // Remove from shared state
    this.depsExports.collab.collab.sharedData[
      'user-containers:containers'
    ].delete(containerId);

    // Update nginx to remove container services
    await this._updateNginx(
      this.depsExports.collab.collab.sharedData['user-containers:containers']
    );

    // Delete graph node
    const id = userContainerNodeId(containerId);
    const e: TEventDeleteNode = {
      type: 'core:delete-node',
      id,
    };

    this.depsExports.reducers.processEvent(e, requestData);
  }

  //
  async _setRunner(event: TEventSelectRunner, requestData: RequestData) {
    // Extract user_id from JWT (TJwtUser)
    const jwt = requestData.jwt as TJwtUser;
    const user_id = jwt?.user?.id;

    if (!user_id) {
      throw new ForbiddenException([
        { message: 'User authentication required' },
      ]);
    }

    const containerId = event.user_container_id;
    const runnerId = event.runner_id;

    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];
    const container = sduc.get(containerId);

    if (!container) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    // Verify runner exists
    const runner = this.depsExports['user-containers'].getRunner(runnerId);
    if (!runner) {
      throw new NotFoundException([
        { message: `Runner ${runnerId} not found` },
      ]);
    }

    // Update container with runner ID only (no token storage)
    sduc.set(containerId, {
      ...container,
      runner: { id: runnerId },
    });
  }

  //
  async _start(event: TEventStart, requestData: RequestData) {
    // Extract user_id from JWT (TJwtUser)
    const jwt = requestData.jwt as TJwtUser;
    const user_id = jwt?.user?.id;

    if (!user_id) {
      throw new ForbiddenException([
        { message: 'User authentication required' },
      ]);
    }

    const containerId = event.user_container_id;

    const sduc =
      this.depsExports.collab.collab.sharedData['user-containers:containers'];
    const container = sduc.get(containerId);

    if (!container) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    // Check that runner is set
    if (
      !container.runner ||
      !container.runner.id ||
      container.runner.id === 'none'
    ) {
      throw new ForbiddenException([
        { message: 'Runner must be set before starting container' },
      ]);
    }

    const runnerId = container.runner.id;

    // Generate hosting token (TJwtUserContainer) for the container
    // Get project_id from JWT or container context
    const project_id =
      (jwt as any)?.project_id || (container as any)?.project_id;
    if (!project_id) {
      throw new ForbiddenException([
        { message: 'Project ID required for token generation' },
      ]);
    }

    const tokenManager = this.depsExports.gateway.tokenManager;
    const hostingToken = tokenManager.generateJWTToken({
      type: 'user_container_token',
      project_id,
      user_container_id: containerId,
      scope: 'container:access',
    });

    // Get runner from registry
    const runner = this.depsExports['user-containers'].getRunner(runnerId);
    if (!runner) {
      throw new NotFoundException([
        { message: `Runner ${runnerId} not found` },
      ]);
    }

    // Call runner's start method with container and JWT token
    // Token is NOT stored in shared data - it's only passed to runner
    // The runner will use generateCommand internally if needed
    await runner.start(container, hostingToken);
  }

  //
}

export const userContainerNodeId = (user_container_id: string) =>
  `user-container:${user_container_id}`;
