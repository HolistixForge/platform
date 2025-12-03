import { EPriority, log } from '@holistix/log';
import { loadModules } from '@holistix/module';
import { GatewayState } from '../state/GatewayState';
import { PermissionManager } from '../permissions';
import { ProjectRoomsManager } from '../state/ProjectRooms';
import { OAuthManager } from '../oauth';
import { TokenManager } from '../tokens';
import { PermissionRegistry, ProtectedServiceRegistry } from '@holistix/gateway';

export interface GatewayInstances {
  gatewayState: GatewayState;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  tokenManager: TokenManager;
  projectRooms: ProjectRoomsManager;
  permissionRegistry: PermissionRegistry;
  protectedServiceRegistry: ProtectedServiceRegistry;
}
import { setGatewayInstances, getGatewayInstances } from './gateway-instances';
import { createBackendModulesConfig } from '../config/modules';

// Cleanup interval reference (stored to clear on shutdown)
let oauthCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize Gateway for Organization
 *
 * This creates all instances and registers them with GatewayState.
 * GatewayState pulls data from Ganymede, and providers load their data
 * when they are registered.
 *
 * @param organizationId - Organization ID
 * @param gatewayId - Gateway ID
 * @param organizationToken - Organization token for Ganymede auth
 * @returns Gateway instances (state and managers)
 */
export async function initializeGatewayForOrganization(
  organizationId: string,
  gatewayId: string,
  organizationToken: string
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

  // 4. Register all managers with GatewayState
  // Registration will automatically load data from pulled snapshot
  gatewayState.register('permissions', permissionManager);
  gatewayState.register('oauth', oauthManager);
  gatewayState.register('projects', projectRooms);

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
  const instances: GatewayInstances = {
    gatewayState,
    permissionManager,
    oauthManager,
    tokenManager,
    projectRooms,
    permissionRegistry,
    protectedServiceRegistry,
  };
  setGatewayInstances(instances);

  // 6. Load backend modules (collab, reducers, core-graph, gateway, user-containers)
  // Modules are loaded after managers are created so gateway module can access them
  const modulesConfig = createBackendModulesConfig(
    organizationId,
    organizationToken,
    gatewayId,
    permissionManager,
    oauthManager,
    tokenManager,
    permissionRegistry,
    protectedServiceRegistry
  );
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    `Loading ${modulesConfig.length} backend modules...`
  );
  loadModules(modulesConfig);
  log(EPriority.Info, 'GATEWAY_INIT', 'Backend modules loaded successfully');

  // 7. Start periodic OAuth cleanup (every hour)
  if (oauthCleanupInterval) {
    clearInterval(oauthCleanupInterval);
  }
  oauthCleanupInterval = setInterval(() => {
    oauthManager.cleanupExpired();
  }, 60 * 60 * 1000); // 1 hour = 60 minutes * 60 seconds * 1000 ms
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    'Started OAuth cleanup timer (runs every hour)'
  );

  // 8. Log statistics
  const oauthStats = oauthManager.getStats();
  log(
    EPriority.Info,
    'GATEWAY_INIT',
    `Gateway initialized: ${projectRooms.getProjectCount()} projects, ` +
      `${oauthStats.clients} OAuth clients`
  );

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

  // Stop OAuth cleanup timer
  if (oauthCleanupInterval) {
    clearInterval(oauthCleanupInterval);
    oauthCleanupInterval = null;
    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Stopped OAuth cleanup timer');
  }

  const instances = getGatewayInstances();
  if (!instances) {
    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'No gateway instances to shutdown');
    return;
  }

  // Cleanup expired OAuth tokens/codes (final cleanup)
  instances.oauthManager.cleanupExpired();

  // Shutdown GatewayState (stops autosave and pushes final data)
  await instances.gatewayState.shutdown();

  log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Gateway shutdown complete');
}
