import { log } from '@monorepo/log';
import { gatewayState } from '../state';
import { permissionManager } from '../permissions';
import { ProjectRoomsManager } from '../state/ProjectRooms';
import { oauthManager } from '../oauth';
import { containerTokenManager } from '../containers';
import { TOrganizationConfig } from '../types/organization-config';

/**
 * Initialize Gateway for Organization
 *
 * This is called once when the gateway starts up.
 * It initializes all managers with the organization configuration.
 */
export async function initializeGateway(
  config: TOrganizationConfig
): Promise<ProjectRoomsManager> {
  log(
    6,
    'GATEWAY_INIT',
    `Initializing gateway for organization: ${config.organization_id}`
  );

  // 1. Initialize GatewayState
  gatewayState.initialize(config.organization_id, config.gateway_id);

  // 2. Load existing state from disk (if any)
  const loaded = await gatewayState.load();
  if (loaded) {
    log(6, 'GATEWAY_INIT', 'Loaded existing gateway state from disk');
  } else {
    log(6, 'GATEWAY_INIT', 'Starting with fresh gateway state');
  }

  // 3. Initialize PermissionManager from organization config
  await permissionManager.initializeFromConfig({
    members: config.members,
  });
  log(
    6,
    'GATEWAY_INIT',
    `Initialized permissions for ${
      permissionManager.getAllUsers().length
    } users`
  );

  // 4. Initialize ProjectRooms for all projects in the organization
  const projectRooms = new ProjectRoomsManager();
  for (const project_id of config.projects) {
    await projectRooms.initializeProject(project_id);
    log(6, 'GATEWAY_INIT', `Initialized YJS room for project: ${project_id}`);
  }

  // 5. Start auto-save timers
  gatewayState.startAutoSave();
  projectRooms.startAutoSave();
  log(6, 'GATEWAY_INIT', 'Started auto-save timers');

  // 6. Log statistics
  const oauthStats = oauthManager.getStats();
  const containerStats = containerTokenManager.getStats();
  log(
    6,
    'GATEWAY_INIT',
    `Gateway initialized: ${projectRooms.getProjectCount()} projects, ` +
      `${oauthStats.clients} OAuth clients, ${containerStats.total} container tokens`
  );

  return projectRooms;
}

/**
 * Shutdown Gateway
 *
 * Gracefully shutdown the gateway, saving all state.
 */
export async function shutdownGateway(
  projectRooms: ProjectRoomsManager
): Promise<void> {
  log(6, 'GATEWAY_SHUTDOWN', 'Initiating graceful shutdown...');

  // Stop auto-save timers
  gatewayState.stopAutoSave();
  projectRooms.stopAutoSave();

  // Save all state
  await projectRooms.shutdown(); // Saves all project YJS state
  await gatewayState.save(); // Saves organization state

  // Cleanup expired OAuth tokens/codes
  oauthManager.cleanupExpired();

  log(6, 'GATEWAY_SHUTDOWN', 'Gateway shutdown complete');
}
