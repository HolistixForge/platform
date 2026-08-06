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
import {
  TUserContainer,
  MACHINE_HEALTH_TIMEOUT_SECONDS,
} from './servers-types';
import {
  TEventNew,
  TEventWatchdog,
  TEventActivity,
  TUserContainersEvents,
  TEventMapHttpService,
  TEventDelete,
  TEventSelectRunner,
  TEventRunnerHealth,
  TEventStart,
  TEventStop,
} from './servers-events';
import { TUserContainersExports } from '..';
import { SharedMap } from '@holistix-forge/collab-engine';
import { TRunnerPlacement } from './placement-shape';

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

  /**
   * The hosting token each started container is holding, for the VPN.
   *
   * `vpn-auth-verify.sh` compares what a connecting container presents against
   * this, so that the client certificate — shared by every container in the
   * organization — proves membership and the token proves *which* container.
   *
   * In memory and not in shared state, for the same reason the auth-guard
   * secret is: shared state is a CRDT replicated to every client in the
   * project, and a token that lets a container claim its own address has no
   * business being replicated to a browser. A gateway restart loses the map,
   * and the containers it had started are restarted through it anyway.
   */
  private readonly hostingTokens = new Map<string, string>();
  /**
   * What each container presents on the VPN, and not its hosting token.
   *
   * OpenVPN keeps a password in a fixed buffer — 128 bytes on the Alpine build
   * of 2.6, larger on the Ubuntu one, and `--max-password-size` only lands in
   * 2.7. A JWT is some 740 bytes, so the same container was admitted or
   * refused depending on which base image it was built from, and the server
   * said nothing but "wrong password". Measured: an Alpine container presented
   * 127 characters of a 743-character token.
   *
   * Short, random, and per container. It also keeps a bearer token out of
   * openvpn's memory and out of the environment of the scripts it runs.
   */
  private readonly vpnSecrets = new Map<string, string>();

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
      case 'user-container:runner-health':
        return this._runnerHealth(event, requestData);
      case 'user-container:start':
        return this._start(event, requestData);
      case 'user-container:stop':
        return this._stop(event, requestData);

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

    // Only this project's catalogue: built-in images plus whatever this project
    // registered. Passing no scope here would sync every tenant's images into
    // every project's shared state, which is replicated to every client in the
    // project.
    const allImages = this.depsExports['user-containers'].imageRegistry.getAll(
      event.project_id
    );

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

    // Get image definition from registry, scoped to this project: a built-in
    // image, or one this project registered. Never another tenant's.
    const organizationId = this.depsExports.gateway.organization_id;
    const imageDef = this.depsExports['user-containers'].imageRegistry.get(
      event.imageId,
      project_id
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

      await this._updateNginx(requestData.project_id ?? '', sduc);
    }
  }

  //

  async _updateNginx(projectId: string, sduc: SharedMap<TUserContainer>) {
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
    this.depsExports.gateway.updateReverseProxy(projectId, services);
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
    this._updateNginx(project_id, sduc);

    // A machine that stopped answering leaves the project's targets. Same
    // threshold as the container watchdog above, because a live container on a
    // dead machine is a state no one can act on.
    const machines = collab.sharedData['user-containers:machines'];
    machines.forEach((machine) => {
      if (
        machine.last_health_at &&
        secondAgo(machine.last_health_at, event.date) <=
          MACHINE_HEALTH_TIMEOUT_SECONDS
      ) {
        return;
      }
      machines.delete(machine.machine_id);
    });
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

    // The container is going; its credential should not outlive it. Rewritten
    // rather than left, because a token still in the file is one that would
    // still admit whatever presented it.
    // Republished when *either* map gave something up, not only the token map.
    // `_publishVpnCredentials` writes from `vpnSecrets`, so a secret removed
    // while no hosting token happened to exist alongside it would have stayed
    // live in the file the VPN checks against — the two are written together
    // everywhere today, and that is a coincidence this should not rest on.
    const hadSecret = this.vpnSecrets.delete(containerId);
    const hadToken = this.hostingTokens.delete(containerId);
    if (hadSecret || hadToken) {
      await this._publishVpnCredentials();
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
    await this._updateNginx(
      requestData.project_id ?? '',
      collab.sharedData['user-containers:containers']
    );

    // Delete graph node
    const id = userContainerNodeId(containerId);
    const e: TEventDeleteNode = {
      type: 'core:delete-node',
      id,
    };

    this.depsExports.reducers.processEvent(e, requestData);
  }

  /**
   * A runner reporting that it is still connected.
   *
   * The machine is recorded against the authenticated user, never against a
   * value in the event: this is what makes a machine belong to someone, and a
   * runner that could name its own owner could enrol itself into a project it
   * was never invited to.
   */
  async _runnerHealth(event: TEventRunnerHealth, requestData: RequestData) {
    const jwt = requestData.jwt as TJwtUser;
    const user_id = jwt?.user?.id;

    if (!user_id) {
      throw new ForbiddenException([
        { message: 'User authentication required' },
      ]);
    }

    const collab = this.getCollab(requestData);
    const machines = collab.sharedData['user-containers:machines'];
    const existing = machines.get(event.machine_id);

    // A machine already claimed by someone else is not a naming collision to
    // resolve, it is a machine id being reused — deliberately or by a restored
    // backup. Refusing keeps one member from taking over another's placement.
    if (existing && existing.user_id !== user_id) {
      throw new ForbiddenException([
        { message: `Machine ${event.machine_id} belongs to another user` },
      ]);
    }

    machines.set(event.machine_id, {
      machine_id: event.machine_id,
      user_id,
      label: event.label,
      last_health_at: new Date().toISOString(),
    });
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

    // Record whose machine a local placement lands on.
    //
    // "Local" is not one place: every member of a project has their own
    // machine, so without an owner the platform cannot tell which runner to
    // ask. Taken from the JWT rather than from the event — the first placement
    // on a machine can only be made by its owner, which is how that machine
    // opts into the project at all.
    //
    // Once it has, and while its runner stays connected, other members can
    // place services there too. That is a real grant: a runner executes what
    // the platform sends it, so opting a laptop into a project means agreeing
    // to run the project's workloads on it.
    //
    // Absent for the platform runner, which belongs to no one in particular.
    const isLocal = runnerId === 'local';

    // Which machine, and not only whose. Enrolment mints an identifier per
    // machine, so a member with a laptop and a desktop has two, and `user_id`
    // alone cannot say which of them was asked.
    //
    // Optional rather than required, deliberately. The mode that exists today
    // hands the user a `docker run` to paste, and it works — refusing a
    // placement that names no machine would break it before the machine picker
    // that would supply one exists. So the strictness lives on the runner,
    // where `assertPlacementIsForUs` refuses anything that does not name it:
    // an unnamed placement is simply one no enrolled runner will pick up,
    // which is exactly what it means today.
    const placement: { user_id?: string; machine_id?: string } = isLocal
      ? {
          user_id,
          ...(event.machine_id ? { machine_id: event.machine_id } : {}),
        }
      : {};

    // Tell Ganymede this machine is now in this project, before writing the
    // placement — because Ganymede is what decides whether it may be.
    //
    // Only a machine's own owner can make the first placement on it, and that
    // rule lives there, against the runners table, rather than here against
    // collab state: the machine catalog in this document only holds machines
    // whose runner is already heartbeating into this project, and a machine's
    // first placement is what puts it there. Asking this document would mean
    // no machine could ever join.
    //
    // Failing loudly rather than writing anyway. A placement Ganymede refused
    // is one no runner will ever be handed — the machine would never learn the
    // project exists — so a container written here would sit forever looking
    // like it was about to start. Somebody clicked; they should be told.
    if (isLocal && event.machine_id) {
      await this._optMachineIntoProject(
        event.machine_id,
        requestData.project_id,
        user_id
      );
    }

    // Runner data, not just the id: `start` writes what the runner reported
    // back here — the docker command, the broker's container id — and this used
    // to replace the whole object, so choosing a runner twice erased it.
    sduc.set(containerId, {
      ...container,
      runner: { id: runnerId, ...placement },
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

    // Recorded before the container is asked to start, so the credential is
    // already there when it connects. The other order is a race the container
    // loses by being refused, which looks from the UI like a service that will
    // not come up.
    this.hostingTokens.set(containerId, hostingToken);
    this.vpnSecrets.set(containerId, this._newVpnSecret());
    await this._publishVpnCredentials();

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
      vpn_secret: this.vpnSecrets.get(containerId),
      // Only in local development, and only from the gateway's environment:
      // this module cannot read process.env for itself.
      // `host-gateway` rather than the bridge address: a platform container
      // sits on a private network of its own, where the default bridge's
      // gateway is not routable. Docker resolves this one from any network.
      dev_host_ip: gatewayExports.environment?.devMode
        ? 'host-gateway'
        : undefined,
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
    //
    // `stopped_at` goes with it. A container left marked stopped after a
    // successful start is one `placementsFor` keeps skipping, so a local
    // service would be started here and reconciled away moments later — and
    // the card would offer play for something that had just run.
    const { stopped_at: _stopped, ...restarted } = startedContainer;
    sduc.set(containerId, {
      ...restarted,
      runner: { ...startedContainer.runner, ...runnerResult },
    });
  }

  //

  /**
   * Stop a service without removing it.
   */
  async _stop(event: TEventStop, requestData: RequestData) {
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

    // Asked of the runner first, and the state written after. The other order
    // marks a service stopped that is still serving, which is the one outcome
    // nobody can act on: the card says stopped, the container answers, and
    // there is no button left that would try again.
    const runner = this.depsExports['user-containers'].getRunner(
      container.runner?.id ?? ''
    );
    if (runner) await runner.stop(container);

    // `httpServices` emptied here rather than left to the watchdog timeout.
    // `_periodic` would clear them thirty seconds later anyway, and in those
    // thirty seconds the gateway still proxies the service's FQDN to a VPN
    // address nobody is on — which answers 502 rather than "stopped".
    sduc.set(containerId, {
      ...container,
      httpServices: [],
      stopped_at: new Date().toISOString(),
    });

    await this._updateNginx(requestData.project_id ?? '', sduc);
  }

  //

  /**
   * Register a per-container OAuth client with Ganymede.
   *
   * Ganymede returns the plaintext secret once and keeps only a bcrypt hash, so
   * this is the only chance to capture it — it goes into `authGuardSecrets` and
   * nowhere else.
   */
  /**
   * Record, in Ganymede, that a machine has been opted into a project.
   *
   * `toGanymede` and not `toGanymedeInternal`: the endpoint authenticates the
   * organization token, the same way `/gateway/tokens/scoped` does, because it
   * has to check that the project belongs to this gateway's organization. A
   * gateway holds one organization's rooms and has no business granting a
   * machine to another organization's project.
   *
   * The user is passed and checked there. It is taken from the JWT by the
   * caller, never from the event — a client that could name the owner could
   * opt somebody else's machine into a project it was never invited to.
   */
  private async _optMachineIntoProject(
    machine_id: string,
    project_id: string | undefined,
    user_id: string
  ): Promise<void> {
    if (!project_id) {
      throw new ForbiddenException([
        { message: 'A local placement needs a project' },
      ]);
    }

    try {
      await this.depsExports.gateway.toGanymede({
        url: `/internal/runners/${machine_id}/projects`,
        method: 'POST',
        jsonBody: { project_id, user_id },
      });
    } catch (e) {
      // Ganymede answers the same way for an unknown machine, a revoked one
      // and one belonging to somebody else, so that a refusal cannot be used
      // to learn whose machines exist. This message says no more than that.
      log(
        EPriority.Warning,
        'USER_CONTAINERS',
        `Machine ${machine_id} refused for project ${project_id}`,
        { user_id }
      );
      throw new ForbiddenException([
        { message: 'This machine cannot be used for this project' },
      ]);
    }

    log(
      EPriority.Info,
      'USER_CONTAINERS',
      `Machine ${machine_id} is in project ${project_id}`,
      { user_id }
    );
  }

  /**
   * Hand the VPN the whole set of container credentials this gateway knows.
   *
   * Every call writes all of them rather than appending: a container this
   * gateway no longer knows about should lose its entry, not linger as a
   * credential nobody can account for.
   */
  /**
   * 32 hex characters — well inside every OpenVPN build's buffer, and long
   * enough that guessing it is not a strategy.
   */
  private _newVpnSecret(): string {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async _publishVpnCredentials(): Promise<void> {
    await this.depsExports.gateway.recordVpnCredentials(
      Array.from(this.vpnSecrets.entries()).map(
        ([user_container_id, token]) => ({ user_container_id, token })
      )
    );
  }

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

  /**
   * What one machine has been asked to run, in one project.
   *
   * Built here and not in the route, because everything a runner needs beyond
   * the container's name lives on this gateway rather than in the collab
   * document: the resolved image reference, the `SETTINGS` blob, and the
   * hosting token — which is also the container's VPN password, and is kept
   * out of the CRDT on purpose since that document reaches every browser in
   * the project.
   *
   * The token is minted if this container has never been started. A machine
   * that comes online for the first time and finds a placement waiting has to
   * be able to act on it; refusing until somebody presses start again would
   * make the runner useless for exactly the case it exists for.
   */
  async placementsFor(
    project_id: string,
    machine_id: string
  ): Promise<TRunnerPlacement[]> {
    const collab = this.getCollabForProject(project_id);
    const sduc = collab.sharedData['user-containers:containers'];

    const mine = Array.from(sduc.copy().values()).filter(
      (c: TUserContainer) =>
        c?.runner?.id === 'local' &&
        (c.runner as { machine_id?: string })?.machine_id === machine_id &&
        // A service somebody stopped is not a placement. This *is* how a local
        // container stops: the runner reconciles against this list, and a
        // container missing from it is one it removes — the same path that
        // already handles a placement deleted from the whiteboard, rather than
        // a second mechanism that would have to agree with it.
        !c.stopped_at
    ) as TUserContainer[];

    const gatewayExports = this.depsExports.gateway;
    const organization_id = gatewayExports.organization_id;
    const gatewayFqdn = gatewayExports.gatewayFQDN;
    const domain = gatewayFqdn.split('.').slice(1).join('.') || 'domain.local';
    const imageRegistry = this.depsExports['user-containers'].imageRegistry;
    // Refused here rather than as a TypeError from inside the request handler.
    // The local runner is registered unconditionally at module load, so this
    // cannot happen today — which is exactly why it would be a bare
    // `Cannot read properties of undefined` if registration order ever changed.
    const runner = this.depsExports['user-containers'].getRunner('local');
    if (!runner) {
      throw new NotFoundException([{ message: 'Runner local not found' }]);
    }

    const placements: TRunnerPlacement[] = [];

    for (const container of mine) {
      const containerId = container.user_container_id;
      // Whose machine this was placed on, recorded by `_setRunner`. Absent, the
      // record predates that and there is no owner to tell the container about
      // — `_start` refuses the same case outright, so this skips rather than
      // handing the runner a placement with an empty user.
      //
      // The cast this loop used to make hid the mismatch: `TRunnerConfig`
      // requires a `user_id` and this one is optional, which the compiler could
      // not see through `unknown`.
      const user_id = (container.runner as { user_id?: string })?.user_id;
      if (!user_id) {
        log(
          EPriority.Warning,
          'USER_CONTAINERS',
          `Container ${containerId} is placed locally with no owner recorded — skipped`,
          { machine_id }
        );
        continue;
      }

      let hostingToken = this.hostingTokens.get(containerId);
      if (!hostingToken) {
        hostingToken =
          await this.depsExports.gateway.tokenManager.generateProjectScopedToken(
            project_id,
            {
              type: 'user_container_token',
              user_container_id: containerId,
              scope: `project:${project_id}:access org:${organization_id}:connect-vpn`,
            }
          );
        this.hostingTokens.set(containerId, hostingToken);
        this.vpnSecrets.set(containerId, this._newVpnSecret());
        await this._publishVpnCredentials();
      }

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
        vpn_secret: this.vpnSecrets.get(containerId),
        dev_host_ip: gatewayExports.environment?.devMode
          ? 'host-gateway'
          : undefined,
      };

      // A rotation replaced the OAuth client, so the container must carry the
      // new id — and so must the shared document.
      //
      // Written back, and not only used locally. `_authGuardSecretFor` caches
      // the new secret under the container id, so on the next poll it answers
      // `known` and pairs it with `container.auth_guard.client_id` read from
      // the document — the *old* id. Every request after a gateway restart
      // then presented a stale id with a fresh secret, and the container's
      // sign-in proxy was refused. `_startContainer` already persists this;
      // this path did not.
      const withGuard =
        authGuard && authGuard.client_id !== container.auth_guard?.client_id
          ? { ...container, auth_guard: { client_id: authGuard.client_id } }
          : container;
      if (withGuard !== container) sduc.set(containerId, withGuard);

      // The same builder the runners use, so a placement and the command the
      // local button prints cannot drift apart.
      const spec = runner.buildLaunchSpec(
        withGuard,
        hostingToken,
        imageRegistry,
        config
      );

      placements.push({
        machine_id,
        project_id,
        user_container_id: containerId,
        name: spec.name,
        imageRef: spec.imageRef,
        settings: spec.settings,
        capabilities: spec.capabilities,
        devices: spec.devices,
        extraHosts: spec.extraHosts,
        networks: [],
      });
    }

    return placements;
  }
}

export const userContainerNodeId = (user_container_id: string) =>
  `user-container:${user_container_id}`;
