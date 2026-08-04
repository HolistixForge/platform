import { TJwtUser } from '@holistix-forge/types';
import { TJwtUserContainer } from './servers-types';
import { secondAgo } from '@holistix-forge/simple-types';
import {
  ForbiddenException,
  NotFoundException,
  log,
  EPriority,
} from '@holistix-forge/log';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
} from '@holistix-forge/core-graph';
import { TGatewayExports, TEventProjectInit } from '@holistix-forge/gateway';
import {
  RequestData,
  TReducersBackendExports,
  TEventPeriodic,
} from '@holistix-forge/reducers';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';
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
import { TUserContainersExports } from '..';
import { SharedMap } from '@holistix-forge/collab-engine';

//

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
  'user-containers': TUserContainersExports;
};

export class UserContainersReducer extends ReducerWithCollab<
  TUserContainersEvents | TEventPeriodic | TEventProjectInit,
  TUserContainersSharedData & TCoreSharedData
> {
  //

  /**
   * Auth guard OAuth client secrets, by container id.
   *
   * Kept in the gateway's memory rather than in shared state, which is a CRDT
   * replicated to every client in the project — a secret written there is a
   * secret handed to every collaborator's browser.
   *
   * Memory-only means a gateway restart loses them; `_authGuardSecretFor()`
   * rotates the client in that case, which is cheap and leaves no way for a
   * stale secret to linger.
   */
  private readonly authGuardSecrets = new Map<string, string>();

  constructor(private readonly depsExports: TRequired) {
    super(depsExports.collab.registry, 'user-containers');
  }

  reduce(
    event: TUserContainersEvents | TEventPeriodic | TEventProjectInit,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'project:init':
        return this._initProject(event, requestData);
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
        return this._periodic(event, requestData);

      default:
        return Promise.resolve();
    }
  }

  private async _initProject(
    event: TEventProjectInit,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const imagesMap = collab.sharedData['user-containers:images'];

    const currentSize = imagesMap.copy().size;
    log(
      EPriority.Info,
      'USER_CONTAINERS_INIT',
      `project:init called for project ${event.project_id}, current images size: ${currentSize}`
    );

    // Only this organization's catalogue: built-in images plus whatever this
    // org supplied. Passing no organization here would sync every tenant's
    // images into every project's shared state, which is replicated to every
    // client in the project.
    const organizationId = this.depsExports.gateway.organization_id;
    const allImages =
      this.depsExports['user-containers'].imageRegistry.getAll(organizationId);

    let synced = 0;
    for (const img of allImages) {
      // Idempotent: skip if already present
      if (imagesMap.get(img.imageId)) {
        continue;
      }
      imagesMap.set(img.imageId, {
        imageId: img.imageId,
        imageName: img.imageName,
        description: img.description,
      });
      synced++;
    }

    log(
      EPriority.Info,
      'USER_CONTAINERS_INIT',
      `Synced ${synced} image(s) to shared map for project ${event.project_id} (${allImages.length} total in registry)`
    );

    // Which runners this deployment actually offers. The platform runner only
    // registers where a container broker is configured, so the UI has no way to
    // know the set without being told.
    const runnersMap = collab.sharedData['user-containers:runners'];
    const runnerIds = this.depsExports['user-containers'].listRunnerIds();
    for (const runnerId of runnerIds) {
      if (runnersMap.get(runnerId)) continue;
      runnersMap.set(runnerId, { runnerId });
    }

    log(
      EPriority.Info,
      'USER_CONTAINERS_INIT',
      `Available runners for project ${event.project_id}: ${runnerIds.join(
        ', '
      )}`
    );
  }

  private generateContainerId(): string {
    // Generate unique ID like "uc_abc123xyz"
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `uc_${timestamp}${random}`;
  }

  /**
   * Generate FQDN for user container (main/default service)
   * Container-aware logic (lives in user-containers module, not gateway/ganymede)
   * @param containerId - Container ID
   * @param organizationId - Organization ID
   * @returns FQDN: uc-{containerId}.org-{orgId}.{domain}
   */
  private generateContainerFQDN(
    containerId: string,
    organizationId: string
  ): string {
    // Extract domain from gateway FQDN (org-{uuid}.{domain} -> {domain})
    // process.env.DOMAIN is not available at runtime in bundled modules
    const gatewayFqdn = this.depsExports.gateway.gatewayFQDN;
    const domain = gatewayFqdn.split('.').slice(1).join('.') || 'domain.local';
    return `uc-${containerId}.org-${organizationId}.${domain}`;
  }

  /**
   * Generate FQDN for a specific service within a container
   * @param containerId - Container ID
   * @param organizationId - Organization ID
   * @param serviceName - Service name (e.g., 'terminal', 'vscode')
   * @returns FQDN:
   *   - Main service (empty/main): uc-{containerId}.org-{orgId}.{domain}
   *   - Named service: {service}.uc-{containerId}.org-{orgId}.{domain}
   */
  private generateServiceFQDN(
    containerId: string,
    organizationId: string,
    serviceName: string
  ): string {
    const baseFqdn = this.generateContainerFQDN(containerId, organizationId);

    // Main/default service uses base FQDN
    if (!serviceName || serviceName === 'main' || serviceName === 'default') {
      return baseFqdn;
    }

    // Named services get subdomain: {service}.uc-{id}.org-{org}.{domain}
    return `${serviceName}.${baseFqdn}`;
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

    // Get image definition from registry, scoped to this organization: a
    // built-in image, or one this org supplied. Never another tenant's.
    const organizationId = this.depsExports.gateway.organization_id;
    const imageDef = this.depsExports['user-containers'].imageRegistry.get(
      event.imageId,
      organizationId
    );

    if (!imageDef) {
      throw new Error(`Image ${event.imageId} not found in registry`);
    }

    // Generate container ID (string instead of database ID)
    const containerId = this.generateContainerId();

    // Register auth guard OAuth client in Ganymede (per-container)
    const gatewayFqdn = this.depsExports.gateway.gatewayFQDN;
    const domain = gatewayFqdn.split('.').slice(1).join('.') || 'domain.local';
    let authGuardConfig: { client_id: string } | undefined;

    try {
      const client = await this._registerAuthGuardClient(
        containerId,
        organizationId,
        domain
      );
      authGuardConfig = { client_id: client.client_id };
    } catch (e: any) {
      log(
        EPriority.Warning,
        'AUTH_GUARD',
        `Failed to register auth guard OAuth client: ${e.message}`
      );
    }

    // Create container in shared state (not database)
    const container: TUserContainer = {
      user_container_id: containerId,
      container_name: event.containerName,
      image_id: imageDef.imageId,
      runner: { id: 'none' },
      auth_guard: authGuardConfig,
      ip: undefined,
      httpServices: [],
      last_watchdog_at: null,
      last_activity: null,
      system: undefined,
      created_at: new Date().toISOString(),
    };

    // Store in shared state
    const collab = this.getCollab(requestData);
    collab.sharedData['user-containers:containers'].set(containerId, container);

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

    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];
    const s = sduc.get(containerId);

    if (!s) {
      throw new NotFoundException([
        { message: `Container ${containerId} not found` },
      ]);
    }

    // Update container state
    // Capture the VPN IP from the request (x-real-ip header set by nginx)
    // This enables nginx reverse proxy routing: FQDN -> VPN IP:port
    const containerIp = requestData.ip;

    sduc.set(containerId, {
      ...s,
      last_watchdog_at: new Date().toISOString(),
      system: event.system,
      ip: containerIp || s.ip, // Update IP from request, keep existing if not provided
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

    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];
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

    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];

    const s = sduc.get(containerId);
    if (!s) throw new NotFoundException();

    // Capture the VPN IP from the request (crucial for nginx routing)
    const containerIp = requestData.ip;
    const httpServices = [...s.httpServices];
    let needsUpdate = false;

    // Update IP if changed (may arrive before first watchdog)
    if (containerIp && containerIp !== s.ip) {
      needsUpdate = true;
    }

    if (
      !httpServices.find(
        (service) => service.name === event.name && service.port === event.port
      )
    ) {
      // Generate per-service FQDN for routing
      // Format: {service}.uc-{containerId}.org-{orgId}.{domain}
      // Main/default service: uc-{containerId}.org-{orgId}.{domain}
      const serviceFQDN = this.generateServiceFQDN(
        containerId,
        this.depsExports.gateway.organization_id,
        event.name
      );

      httpServices.push({
        host: serviceFQDN,
        name: event.name,
        port: event.port,
        secure: true,
      });

      // When auth guard is present and this is the first service, also register
      // the base FQDN (uc-{cid}.org-{oid}.{domain}) pointing to the guard port.
      // This ensures /__auth/callback is reachable for OAuth flow.
      if (
        s.auth_guard &&
        !httpServices.find((service) => service.name === '__guard_base')
      ) {
        const baseFQDN = this.generateContainerFQDN(
          containerId,
          this.depsExports.gateway.organization_id
        );
        httpServices.push({
          host: baseFQDN,
          name: '__guard_base',
          port: 8443,
          secure: true,
        });
      }

      needsUpdate = true;
    }

    if (needsUpdate) {
      sduc.set(containerId, {
        ...s,
        httpServices,
        ip: containerIp || s.ip, // Update IP from request
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

  async _periodic(event: TEventPeriodic, requestData: RequestData) {
    const project_id = requestData.project_id;
    if (!project_id) {
      // Should not happen with per-project periodic events
      return;
    }

    // Process containers for this specific project
    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];
    // remove declared http services for container that did not
    // sent watchdog event for 30 secondes (down)
    sduc.forEach((container: TUserContainer) => {
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
    const collab = this.getCollab(requestData);
    const container =
      collab.sharedData['user-containers:containers'].get(containerId);

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

    // Delete auth guard OAuth client from Ganymede
    if (container.auth_guard?.client_id) {
      try {
        await this._deleteAuthGuardClient(
          containerId,
          container.auth_guard.client_id
        );
      } catch (e: any) {
        log(
          EPriority.Warning,
          'AUTH_GUARD',
          `Failed to delete auth guard OAuth client: ${e.message}`
        );
      }
    }

    // Remove from shared state
    collab.sharedData['user-containers:containers'].delete(containerId);

    // Update nginx to remove container services
    await this._updateNginx(collab.sharedData['user-containers:containers']);

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

    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];
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

    const collab = this.getCollab(requestData);
    const sduc = collab.sharedData['user-containers:containers'];
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
    // project_id comes from requestData (set by collab route from event body)
    const project_id = requestData.project_id;
    if (!project_id) {
      throw new ForbiddenException([
        { message: 'Project ID required for token generation' },
      ]);
    }

    // Generate hosting token via TokenManager (calls Ganymede internally)
    // Reducer constructs the complete payload - TokenManager is just a pipe
    const tokenManager = this.depsExports.gateway.tokenManager;
    const organization_id = this.depsExports.gateway.organization_id;
    const hostingToken = await tokenManager.generateProjectScopedToken(
      project_id,
      {
        type: 'user_container_token',
        user_container_id: containerId,
        // Scopes (space-separated, standard JWT format):
        // - project:${project_id}:access - for /collab/event access (requireProjectAccess)
        // - org:${organization_id}:connect-vpn - for /collab/vpn-config access (requireScope)
        scope: `project:${project_id}:access org:${organization_id}:connect-vpn`,
      }
    );

    // Get runner from registry
    const runner = this.depsExports['user-containers'].getRunner(runnerId);
    if (!runner) {
      throw new NotFoundException([
        { message: `Runner ${runnerId} not found` },
      ]);
    }

    // Build config from gateway exports (not process.env which may not be available)
    const gatewayExports = this.depsExports.gateway;
    const gatewayFqdn = gatewayExports.gatewayFQDN;
    // Extract domain from gateway FQDN: org-{uuid}.{domain} -> {domain}
    const domain = gatewayFqdn.split('.').slice(1).join('.') || 'domain.local';
    // The auth guard secret is held on the gateway, never in shared state, so
    // it is resolved here and handed to the runner through the config.
    const authGuard = await this._authGuardSecretFor(
      container,
      organization_id,
      domain
    );

    const config = {
      user_id,
      project_id,
      frontend_fqdn: domain,
      ganymede_fqdn: `ganymede.${domain}`,
      gateway_fqdn: gatewayFqdn,
      organization_id,
      auth_guard_client_secret: authGuard?.client_secret,
    };

    // A rotation replaced the client, so the container must carry the new id.
    const startedContainer: TUserContainer =
      authGuard && authGuard.client_id !== container.auth_guard?.client_id
        ? { ...container, auth_guard: { client_id: authGuard.client_id } }
        : container;

    // Call runner - returns runner-specific data (e.g. docker command for local runner)
    const imageRegistry = this.depsExports['user-containers'].imageRegistry;
    const runnerResult = await runner.start(
      startedContainer,
      hostingToken,
      imageRegistry,
      config
    );

    // Merge runner result into container.runner in shared state
    sduc.set(containerId, {
      ...startedContainer,
      runner: { ...startedContainer.runner, ...runnerResult },
    });
  }

  //

  /**
   * Register a per-container OAuth client with Ganymede.
   *
   * Ganymede returns the plaintext secret once and keeps only a bcrypt hash, so
   * this is the only chance to capture it — it goes into `authGuardSecrets` and
   * nowhere else.
   */
  private async _registerAuthGuardClient(
    containerId: string,
    organizationId: string,
    domain: string
  ): Promise<{ client_id: string; client_secret: string }> {
    const result = await this.depsExports.gateway.toGanymedeInternal<{
      client_id: string;
      client_secret: string;
    }>({
      url: '/internal/oauth/clients',
      method: 'POST',
      jsonBody: {
        redirect_uris: [
          `https://uc-${containerId}.org-${organizationId}.${domain}/__auth/callback`,
        ],
        grants: ['authorization_code', 'refresh_token'],
        label: `guard:${containerId}`,
      },
    });

    this.authGuardSecrets.set(containerId, result.client_secret);

    log(
      EPriority.Info,
      'AUTH_GUARD',
      `Registered OAuth client for container ${containerId}`,
      { client_id: result.client_id }
    );

    return result;
  }

  private async _deleteAuthGuardClient(
    containerId: string,
    clientId: string
  ): Promise<void> {
    this.authGuardSecrets.delete(containerId);
    await this.depsExports.gateway.toGanymedeInternal({
      url: `/internal/oauth/clients/${clientId}`,
      method: 'DELETE',
    });
    log(
      EPriority.Info,
      'AUTH_GUARD',
      `Deleted OAuth client for container ${containerId}`,
      { client_id: clientId }
    );
  }

  /**
   * Resolve the auth guard secret to hand to a starting container.
   *
   * Secrets only live in this gateway's memory, so a gateway restart between
   * container creation and container start leaves us with a client id we can no
   * longer authenticate as. Ganymede cannot reveal the old secret (it stores a
   * bcrypt hash), so rotate: drop the orphaned client and register a fresh one.
   *
   * Returns the client id actually in force — the caller must write it back to
   * shared state when it changed.
   */
  private async _authGuardSecretFor(
    container: TUserContainer,
    organizationId: string,
    domain: string
  ): Promise<{ client_id: string; client_secret: string } | undefined> {
    if (!container.auth_guard) return undefined;

    const containerId = container.user_container_id;
    const known = this.authGuardSecrets.get(containerId);
    if (known) {
      return {
        client_id: container.auth_guard.client_id,
        client_secret: known,
      };
    }

    log(
      EPriority.Info,
      'AUTH_GUARD',
      `No secret held for container ${containerId}, rotating its OAuth client`,
      { client_id: container.auth_guard.client_id }
    );

    try {
      await this._deleteAuthGuardClient(
        containerId,
        container.auth_guard.client_id
      );
    } catch (e: any) {
      // A client we cannot delete is a leftover row in Ganymede, not a reason to
      // refuse the start — the new client below is what the container will use.
      log(
        EPriority.Warning,
        'AUTH_GUARD',
        `Failed to delete stale auth guard OAuth client: ${e.message}`
      );
    }

    try {
      return await this._registerAuthGuardClient(
        containerId,
        organizationId,
        domain
      );
    } catch (e: any) {
      log(
        EPriority.Warning,
        'AUTH_GUARD',
        `Failed to re-register auth guard OAuth client: ${e.message}`
      );
      return undefined;
    }
  }
}

export const userContainerNodeId = (user_container_id: string) =>
  `user-container:${user_container_id}`;
