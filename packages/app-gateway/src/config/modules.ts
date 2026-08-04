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
import { moduleBackend as notionBackend } from '@holistix-forge/notion';
import { moduleBackend as airtableBackend } from '@holistix-forge/airtable';
import { moduleBackend as excalidrawBackend } from '@holistix-forge/excalidraw';
import { moduleBackend as socialsBackend } from '@holistix-forge/socials';
import { moduleBackend as chatsBackend } from '@holistix-forge/chats';
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

  // Read here, in app-gateway, because this is the last place with a real
  // `process`. Module packages are bundled with a browser process shim, so a
  // module reading process.env sees an empty object and concludes "not
  // configured" — see TGatewayEnvironment.
  const brokerEndpoint = process.env.CONTAINER_BROKER_URL;
  const brokerToken = process.env.CONTAINER_BROKER_TOKEN;

  const gatewayConfig = {
    environment: {
      // Both or neither: a half-configured broker would let the platform runner
      // register and then fail on the first start, which reads to the user as a
      // broken button rather than as a mode this deployment does not offer.
      containerBroker:
        brokerEndpoint && brokerToken
          ? { endpoint: brokerEndpoint, token: brokerToken }
          : undefined,
      devMode: process.env.GATEWAY_DEV === '1',
      dockerHostIp: process.env.DOCKER_HOST_IP || '172.17.0.1',
    },
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
  // 9. Content modules (depend on core-graph, collab, reducers)
  //
  // These must be here, not only in the frontend. A module whose menu entry
  // dispatches its own event — `chats:new-chat` rather than `core:new-node`
  // directly — has nothing to handle it if its backend is absent: the click
  // registers, the event goes nowhere, and no node is ever created, with no
  // error anywhere. Excalidraw masked this by dispatching `core:new-node`
  // itself, which core-graph handles regardless.
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
    { module: notionBackend, config: {} },
    { module: airtableBackend, config: {} },
    { module: excalidrawBackend, config: {} },
    { module: socialsBackend, config: {} },
    { module: chatsBackend, config: {} },
  ];
}
