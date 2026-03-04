import { TModule } from '@holistix-forge/module';
import {
  moduleBackend as collabBackend,
  ICollabRegistry,
} from '@holistix-forge/collab';
import { moduleBackend as reducersBackend } from '@holistix-forge/reducers';
import { moduleBackend as coreGraphBackend } from '@holistix-forge/core-graph';
import { moduleBackend as whiteboardBackend } from '@holistix-forge/whiteboard';
import { moduleBackend as tabsBackend } from '@holistix-forge/tabs';
import { moduleBackend as userContainersBackend } from '@holistix-forge/user-containers';
import { moduleBackend as jupyterBackend } from '@holistix-forge/jupyter';
import { moduleBackend as n8nBackend } from '@holistix-forge/n8n';
import { moduleBackend as pgadmin4Backend } from '@holistix-forge/pgadmin4';
import { moduleBackend as vscodeBackend } from '@holistix-forge/vscode';
import { moduleBackend as gatewayBackend } from '../module/module';
import type {
  PermissionManager,
  TokenManager,
  PermissionRegistry,
} from '@holistix-forge/gateway';
import { CONFIG } from '../config';

/**
 * Create backend modules configuration for gateway - EXTERNAL API for modules
 *
 * This function creates the PUBLIC interface that modules use to integrate
 * with gateway infrastructure. Managers are passed TO modules via their
 * load({ config }) function.
 *
 * Returns list of modules to load in dependency order.
 * Modules are loaded sequentially and dependencies must be loaded first.
 *
 * What gets passed to modules:
 * - permissionManager: For checking permissions in reducers
 * - tokenManager: For JWT token management
 * - permissionRegistry: For registering module permissions
 * - collabRegistry: For registering shared data schemas
 *
 * This is SEPARATE from GatewayInstances (internal registry):
 * - This config: External API for module integration
 * - GatewayInstances: Internal API for gateway routes/middleware
 *
 * @param organizationId - Organization ID
 * @param organizationToken - Organization token for Ganymede
 * @param gatewayId - Gateway ID
 * @param permissionManager - Permission manager (passed to modules)
 * @param tokenManager - Token manager (passed to modules)
 * @param permissionRegistry - Permission registry (passed to modules)
 * @param collabRegistry - CollabRegistry for multi-project architecture (passed to modules)
 * @returns Module configuration array in dependency order
 */
export function createBackendModulesConfig(
  organizationId: string,
  organizationToken: string,
  gatewayId: string,
  permissionManager: PermissionManager,
  tokenManager: TokenManager,
  permissionRegistry: PermissionRegistry,
  collabRegistry: ICollabRegistry
): { module: TModule<never, object>; config: object }[] {
  // Collab config - multi-project architecture
  // Each project has its own YJS document managed by ProjectRoomsManager
  // Modules register their shared data schema with the registry at load time
  // Reducers get project-specific collab instances via registry.getCollabForProject()
  const collabConfig = {
    registry: collabRegistry,
  };

  // Gateway module config
  // Gateway FQDN is the organization's public URL: org-{uuid}.domain.local
  // This is used for VPN config and service URLs
  const domain = process.env.DOMAIN || 'domain.local';
  const gatewayFQDN = `org-${organizationId}.${domain}`;

  const gatewayConfig = {
    organization_id: organizationId,
    organization_token: organizationToken,
    gateway_id: gatewayId,
    gatewayFQDN,
    ganymedeFQDN: CONFIG.GANYMEDE_FQDN,
    gatewayToken: CONFIG.GATEWAY_TOKEN,
    permissionManager,
    tokenManager,
    permissionRegistry,
  };

  // Return modules in dependency order:
  // 1. collab (no dependencies)
  // 2. reducers (no dependencies)
  // 3. gateway (depends on collab, reducers) - must load before whiteboard for permissions
  // 4. core-graph (depends on collab, reducers)
  // 5. whiteboard (depends on collab, reducers, core-graph, gateway) - handles project:init
  // 6. tabs (depends on collab, reducers) - handles project:init
  // 7. user-containers (depends on core-graph, collab, reducers, gateway)
  // 8. Container image modules (depend on user-containers)
  return [
    { module: collabBackend, config: collabConfig },
    { module: reducersBackend, config: {} },
    { module: gatewayBackend, config: gatewayConfig },
    { module: coreGraphBackend, config: {} },
    { module: whiteboardBackend, config: {} },
    { module: tabsBackend, config: {} },
    { module: userContainersBackend, config: {} },
    { module: jupyterBackend, config: {} },
    { module: n8nBackend, config: {} },
    { module: pgadmin4Backend, config: {} },
    { module: vscodeBackend, config: {} },
  ];
}
