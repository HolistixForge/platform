import type { TModule } from '@holistix-forge/module';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

import {
  TokenManager,
  PermissionManager,
  OAuthManager,
  CredentialManager,
} from './lib/managers';

//

import { PermissionRegistry } from './lib/permission-registry';
import { ProtectedServiceRegistry } from './lib/protected-service-registry';
import { CredentialProviderRegistry } from './lib/credential-provider-registry';

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
  credentialManager: CredentialManager;
  permissionRegistry: PermissionRegistry;
  protectedServiceRegistry: ProtectedServiceRegistry;
  credentialProviderRegistry: CredentialProviderRegistry;
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
  CredentialManager,
  type TOAuthClient,
  type TOAuthCode,
  type TOAuthToken,
  type TCreateApiKeyCredentialRequest,
  type TOAuthCredentialState,
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

// Export CredentialProviderRegistry and types
export { CredentialProviderRegistry } from './lib/credential-provider-registry';
export type {
  TCredentialCollectionMethod,
  TApiKeyField,
  TApiKeyCredentialProvider,
  TOAuthConfig,
  TOAuthCredentialProvider,
  TCredentialProvider,
  TStoredCredentialBase,
  TStoredApiKeyCredential,
  TStoredOAuthCredential,
  TStoredCredential,
  TCredentialSummary,
  TDecryptedCredential,
} from './lib/credential-provider-types';

export type { TEventDisableShutdown } from './lib/gateway-events';
