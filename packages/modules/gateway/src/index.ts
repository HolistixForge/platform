import type { TModule } from '@holistix-forge/module';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

import {
  TokenManager,
  PermissionManager,
  OAuthManager,
  DNSManager,
} from './lib/managers';

//

import { PermissionRegistry } from './lib/permission-registry';
import { ProtectedServiceRegistry } from './lib/protected-service-registry';

export type TGatewayExports = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  updateReverseProxy: (
    services: { host: string; ip: string; port: number }[]
  ) => Promise<void>;
  gatewayFQDN: string;
  organization_id: string;
  tokenManager: TokenManager;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  dnsManager: DNSManager;
  permissionRegistry: PermissionRegistry;
  protectedServiceRegistry: ProtectedServiceRegistry;
};

//

export const moduleFrontend: TModule<
  { collab: TCollabFrontendExports },
  TGatewayExports
> = {
  name: 'gateway',
  version: '0.0.1',
  description: 'Gateway module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'gateway', 'gateway');
  },
};

//

export type { TGatewayEvents } from './lib/gateway-events';
export type { TEventLoad } from './lib/gateway-events';
export type { TGatewaySharedData, TGatewayMeta } from './lib/gateway-types';

// Export manager interfaces and types
export {
  TokenManager,
  PermissionManager,
  OAuthManager,
  DNSManager,
  type TOAuthClient,
  type TOAuthCode,
  type TOAuthToken,
} from './lib/managers';

// Export PermissionRegistry
export {
  PermissionRegistry,
  type PermissionDefinition,
} from './lib/permission-registry';

// Export ProtectedServiceRegistry and related types
export {
  ProtectedServiceRegistry,
  type ProtectedServiceHandler,
  type ProtectedServiceRequestContext,
  type ProtectedServiceResolution,
} from './lib/protected-service-registry';

export type { TEventDisableShutdown } from './lib/gateway-events';
