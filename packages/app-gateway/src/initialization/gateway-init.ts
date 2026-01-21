import * as http from 'http';
import * as https from 'https';
import { EPriority, log } from '@holistix-forge/log';
import { loadModules } from '@holistix-forge/module';
import { GatewayState } from '../state/GatewayState';
import { PermissionManager } from '../permissions';
import { ProjectRoomsManager } from '../state/ProjectRooms';
import { CollabRegistry } from '../state/CollabRegistry';
import { OAuthManager } from '../oauth';
import { TokenManager } from '../tokens';
import {
  PermissionRegistry,
  ProtectedServiceRegistry,
} from '@holistix-forge/gateway';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import { graftYjsWebsocket } from '../websocket';
import { GatewayPeriodicTimer } from '../timers/periodic-events';
import { GatewayShutdownTimer } from '../timers/gateway-shutdown';

/**
 * GatewayInstances - Internal Service Registry
 *
 * This interface defines the INTERNAL registry of gateway infrastructure.
 * These instances are stored in a global registry and accessed by:
 * - Gateway routes (collab, permissions, OAuth, protected services)
 * - Gateway middleware (authentication, authorization)
 * - Gateway shutdown logic
 *
 * This is SEPARATE from the module config that gets passed TO modules.
 * See createBackendModulesConfig() for the external API exposed to modules.
 */
export interface GatewayInstances {
  gatewayState: GatewayState;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  tokenManager: TokenManager;
  projectRooms: ProjectRoomsManager;
  collabRegistry: CollabRegistry;
  permissionRegistry: PermissionRegistry;
  protectedServiceRegistry: ProtectedServiceRegistry;
  periodicTimer: GatewayPeriodicTimer;
  shutdownTimer: GatewayShutdownTimer;
}
import { setGatewayInstances, getGatewayInstances } from './gateway-instances';
import { createBackendModulesConfig } from '../config/modules';

/**
 * Initialize Gateway for Organization
 *
 * This creates all instances and registers them with GatewayState.
 * GatewayState pulls data from Ganymede, and providers load their data
 * when they are registered.
 *
 * Multi-project Architecture:
 * - Each project has its own YJS document (managed by ProjectRoomsManager)
 * - CollabRegistry provides per-project collab instances to reducers
 * - Reducers access project-specific data via requestData.project_id
 *
 * Two Distribution Mechanisms:
 * 1. Module Config (External API): Managers passed TO modules via load({ config })
 *    - Purpose: Allow modules to integrate with gateway infrastructure
 *    - Examples: Register permissions, handle OAuth, register protected services
 *    - Distribution: createBackendModulesConfig() → modules receive via config parameter
 *
 * 2. GatewayInstances Registry (Internal API): Managers stored in registry for gateway use
 *    - Purpose: Gateway routes, middleware, and shutdown access infrastructure
 *    - Examples: Route handlers check permissions, middleware validates JWT
 *    - Distribution: setGatewayInstances() → gateway code accesses via getGatewayInstances()
 *
 * @param organizationId - Organization ID
 * @param gatewayId - Gateway ID
 * @param organizationToken - Organization token for Ganymede auth
 * @param servers - HTTP/HTTPS servers for WebSocket grafting
 * @returns Gateway instances (state and managers)
 */
export async function initializeGatewayForOrganization(
  organizationId: string,
  gatewayId: string,
  organizationToken: string,
  servers?: (http.Server | https.Server)[]
): Promise<GatewayInstances> {
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    `Initializing gateway for organization: ${organizationId}`
  );

  // 1. Create GatewayState instance
  const gatewayState = new GatewayState();
  gatewayState.initialize(organizationId, gatewayId);

  // 2. Set organization context and pull data from Ganymede
  await gatewayState.setOrganizationContext(
    organizationId,
    gatewayId,
    organizationToken
  );

  // 3. Create manager instances
  const permissionManager = new PermissionManager();
  const oauthManager = new OAuthManager();
  const tokenManager = new TokenManager();
  const projectRooms = new ProjectRoomsManager();

  // 3.5 Create CollabRegistry for multi-project architecture
  // Must be created before loading modules (modules register schema with it)
  const collabRegistry = new CollabRegistry();

  // 4. Register all managers with GatewayState
  // Registration will automatically load data from pulled snapshot
  gatewayState.register('permissions', permissionManager);
  gatewayState.register('oauth', oauthManager);
  gatewayState.register('projects', projectRooms);

  // 4.5 Wire up CollabRegistry to ProjectRoomsManager
  // This allows registry to get room_id for projects
  collabRegistry.setProjectRooms(projectRooms);

  // 5.5 Create PermissionRegistry instance
  const permissionRegistry = new PermissionRegistry();
  const protectedServiceRegistry = new ProtectedServiceRegistry();

  // 5. Store instances in registry for route access + start auto-save
  gatewayState.startAutosave();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'Started auto-save (pushes to Ganymede every 5min)'
  );
  

  // 6. Load backend modules (collab, reducers, core-graph, gateway, user-containers)
  // Modules are loaded after managers are created so gateway module can access them
  // Modules register their shared data schema with CollabRegistry at load time
  //
  // IMPORTANT: This creates the EXTERNAL API for modules
  // These managers are passed TO modules via their load({ config }) function
  // This is the PUBLIC interface that modules use to integrate with gateway infrastructure
  // (e.g., register permissions, handle OAuth, register protected services)
  const modulesConfig = createBackendModulesConfig(
    organizationId,
    organizationToken,
    gatewayId,
    permissionManager,        // ← Passed to modules for permission registration
    oauthManager,             // ← Passed to modules for OAuth integration
    tokenManager,             // ← Passed to modules for token management
    permissionRegistry,       // ← Passed to modules for permission registration
    protectedServiceRegistry, // ← Passed to modules for protected service registration
    collabRegistry            // ← Passed to modules for shared data schema registration
  );
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    `Loading ${modulesConfig.length} backend modules...`
  );
  const moduleExports = loadModules(modulesConfig) as {
    reducers: TReducersBackendExports;
  };
  log(EPriority.Info, 'GATEWAY_INIT', 'Backend modules loaded successfully');

  // 6.5 Wire up event processor to ProjectRoomsManager
  // This allows ProjectRoomsManager to dispatch project:init events
  projectRooms.setEventProcessor(moduleExports.reducers);
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'Event processor wired to ProjectRoomsManager'
  );

  // 6.5.1 Create and start gateway-specific timers
  const periodicTimer = new GatewayPeriodicTimer(projectRooms, moduleExports.reducers);
  periodicTimer.start();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'Started per-project periodic event timer (5s interval)'
  );

  const shutdownTimer = new GatewayShutdownTimer(projectRooms);
  shutdownTimer.enable();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'Enabled gateway shutdown timer (30 min idle threshold)'
  );

  // 6.6 Initialize WebSocket handler for YJS collaboration
  if (servers && servers.length > 0) {
    graftYjsWebsocket(servers, projectRooms);
    log(
      EPriority.Info,
      'GATEWAY_INIT',
      `WebSocket handler initialized for ${projectRooms.getProjectCount()} projects`
    );
  }

  // 7. Start automatic OAuth cleanup (managed by OAuthManager)
  oauthManager.startAutomaticCleanup();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'OAuth automatic cleanup enabled'
  );

  // 8. Log statistics
  const oauthStats = oauthManager.getStats();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    `Gateway initialized: ${projectRooms.getProjectCount()} projects, ` +
      `${collabRegistry.getSchemaSize()} shared data types registered, ` +
      `${oauthStats.clients} OAuth clients`
  );

  // 9. Store instances in INTERNAL registry for gateway infrastructure
  //
  // IMPORTANT: This is the INTERNAL service locator for gateway's own use
  // These instances are accessed by gateway routes, middleware, and shutdown logic
  // via getGatewayInstances() - they are NOT passed to modules
  //
  // Note: Some managers appear in BOTH places:
  // - Passed to modules: For module integration (e.g., register permissions)
  // - Stored in registry: For gateway internal use (e.g., route handlers)
  const instances: GatewayInstances = {
    gatewayState,                  // ← Internal only (organization context)
    permissionManager,             // ← Both (modules register, routes check)
    oauthManager,                  // ← Both (modules integrate, routes handle OAuth)
    tokenManager,                  // ← Both (modules use, routes validate)
    projectRooms,                  // ← Internal only (project lifecycle management)
    collabRegistry,                // ← Both (modules register, routes access)
    permissionRegistry,            // ← Both (modules register, routes check)
    protectedServiceRegistry,      // ← Both (modules register, routes handle)
    periodicTimer,                 // ← Internal only (gateway timers)
    shutdownTimer,                 // ← Internal only (gateway shutdown)
  };
  setGatewayInstances(instances);

  return instances;
}

/**
 * Shutdown Gateway
 *
 * Gracefully shutdown the gateway, saving all state.
 * Gets instances from the registry.
 */
export async function shutdownGateway(): Promise<void> {
  log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Initiating graceful shutdown...');

  const instances = getGatewayInstances();
  if (!instances) {
    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'No gateway instances to shutdown');
    return;
  }

  // Stop OAuth cleanup timer and do final cleanup
  instances.oauthManager.stopAutomaticCleanup();
  instances.oauthManager.cleanupExpired();

  // Stop gateway timers
  instances.periodicTimer.stop();
  instances.shutdownTimer.disable();

  // Shutdown GatewayState (stops autosave and pushes final data)
  await instances.gatewayState.shutdown();

  log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Gateway shutdown complete');
}
