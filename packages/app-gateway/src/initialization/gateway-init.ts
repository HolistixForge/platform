import { log } from '@monorepo/log';
import { GatewayState } from '../state/GatewayState';
import { PermissionManager } from '../permissions';
import { ProjectRoomsManager } from '../state/ProjectRooms';
import { OAuthManager } from '../oauth';
import { ContainerTokenManager } from '../containers';
import { setGatewayInstances, getGatewayInstances } from './gateway-instances';

export interface GatewayInstances {
  gatewayState: GatewayState;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  containerTokenManager: ContainerTokenManager;
  projectRooms: ProjectRoomsManager;
}

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
export async function initializeGateway(
  organizationId: string,
  gatewayId: string,
  organizationToken: string
): Promise<GatewayInstances> {
  log(
    6,
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
  const containerTokenManager = new ContainerTokenManager(
    process.env.GATEWAY_HMAC_SECRET
  );
  const projectRooms = new ProjectRoomsManager();

  // 4. Register all managers with GatewayState
  // Registration will automatically load data from pulled snapshot
  gatewayState.register('permissions', permissionManager);
  gatewayState.register('oauth', oauthManager);
  gatewayState.register('containers', containerTokenManager);
  gatewayState.register('projects', projectRooms);

  // 5. Store instances in registry for route access + start auto-save
  gatewayState.startAutosave();
  log(6, 'GATEWAY_INIT', 'Started auto-save (pushes to Ganymede every 5min)');
  const instances: GatewayInstances = {
    gatewayState,
    permissionManager,
    oauthManager,
    containerTokenManager,
    projectRooms,
  };
  setGatewayInstances(instances);

  // 6. Log statistics
  const oauthStats = oauthManager.getStats();
  const containerStats = containerTokenManager.getStats();
  log(
    6,
    'GATEWAY_INIT',
    `Gateway initialized: ${projectRooms.getProjectCount()} projects, ` +
      `${oauthStats.clients} OAuth clients, ${containerStats.total} container tokens`
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
  log(6, 'GATEWAY_SHUTDOWN', 'Initiating graceful shutdown...');

  const instances = getGatewayInstances();
  if (!instances) {
    log(6, 'GATEWAY_SHUTDOWN', 'No gateway instances to shutdown');
    return;
  }

  // Cleanup expired OAuth tokens/codes
  instances.oauthManager.cleanupExpired();

  // Shutdown GatewayState (stops autosave and pushes final data)
  await instances.gatewayState.shutdown();

  log(6, 'GATEWAY_SHUTDOWN', 'Gateway shutdown complete');
}
