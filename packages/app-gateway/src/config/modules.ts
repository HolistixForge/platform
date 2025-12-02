import { TModule } from '@monorepo/module';
import { moduleBackend as collabBackend } from '@monorepo/collab';
import { moduleBackend as reducersBackend } from '@monorepo/reducers';
import { moduleBackend as coreGraphBackend } from '@monorepo/core-graph';
import { moduleBackend as userContainersBackend } from '@monorepo/user-containers';
import { moduleBackend as jupyterBackend } from '@monorepo/jupyter';
import { moduleBackend as n8nBackend } from '@monorepo/n8n';
import { moduleBackend as pgadmin4Backend } from '@monorepo/pgadmin4';
import { moduleBackend as gatewayBackend } from '../module/module';
import type {
  PermissionManager,
  OAuthManager,
  TokenManager,
  PermissionRegistry,
  ProtectedServiceRegistry,
} from '@monorepo/gateway';
import { CONFIG } from '../config';

/**
 * Create backend modules configuration for gateway
 *
 * Returns list of modules to load in dependency order.
 * Modules are loaded sequentially and dependencies must be loaded first.
 */
export function createBackendModulesConfig(
  organizationId: string,
  organizationToken: string,
  gatewayId: string,
  permissionManager: PermissionManager,
  oauthManager: OAuthManager,
  tokenManager: TokenManager,
  permissionRegistry: PermissionRegistry,
  protectedServiceRegistry: ProtectedServiceRegistry
): { module: TModule<never, object>; config: object }[] {
  // Collab config - uses YjsServerCollab for server-side (Yjs WebSocket server)
  // The room_id is not used in server mode, but required by config type
  const collabConfig = {
    type: 'yjs-server' as const,
    room_id: 'gateway',
  };

  // Gateway module config
  // Gateway FQDN is provided via GATEWAY_FQDN env var (set by container startup)
  const gatewayFQDN = process.env.GATEWAY_FQDN || CONFIG.GATEWAY_ID;
  const gatewayConfig = {
    organization_id: organizationId,
    organization_token: organizationToken,
    gateway_id: gatewayId,
    gatewayFQDN,
    ganymedeFQDN: CONFIG.GANYMEDE_FQDN,
    gatewayToken: CONFIG.GATEWAY_TOKEN,
    permissionManager,
    oauthManager,
    tokenManager,
    permissionRegistry,
    protectedServiceRegistry,
  };

  // Return modules in dependency order:
  // 1. collab (no dependencies)
  // 2. reducers (no dependencies)
  // 3. core-graph (depends on collab, reducers)
  // 4. gateway (depends on collab, reducers)
  // 5. user-containers (depends on core-graph, collab, reducers, gateway)
  // 6. Container image modules (depend on user-containers)
  return [
    { module: collabBackend, config: collabConfig },
    { module: reducersBackend, config: {} },
    { module: coreGraphBackend, config: {} },
    { module: gatewayBackend, config: gatewayConfig },
    { module: userContainersBackend, config: {} },
    { module: jupyterBackend, config: {} },
    { module: n8nBackend, config: {} },
    { module: pgadmin4Backend, config: {} },
  ];
}
