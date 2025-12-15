import { spawnSync } from 'child_process';
import { TJson } from '@holistix-forge/simple-types';
import { EPriority, log } from '@holistix-forge/log';
import type { TModule } from '@holistix-forge/module';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import { TReducersBackendExports } from '@holistix-forge/reducers';
import { TCollabBackendExports } from '@holistix-forge/collab';
import type {
  TGatewayExports,
  TGatewaySharedData,
} from '@holistix-forge/gateway';

import { GatewayReducer } from './gateway-reducer';
import type {
  PermissionManager,
  OAuthManager,
  TokenManager,
} from '@holistix-forge/gateway';
import { DNSManagerImpl } from '../dns/DNSManager';
import { createGanymedeClient } from '../lib/ganymede-client';

/**
 * Gateway Module Configuration
 * Passed to gateway module load() function
 */
import {
  PermissionRegistry,
  ProtectedServiceRegistry,
} from '@holistix-forge/gateway';

export type GatewayModuleConfig = {
  organization_id: string;
  organization_token: string;
  gateway_id: string;
  gatewayFQDN: string;
  ganymedeFQDN: string;
  gatewayToken: string;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  tokenManager: TokenManager;
  permissionRegistry: PermissionRegistry;
  protectedServiceRegistry: ProtectedServiceRegistry;
};

type TRequired = {
  collab: TCollabBackendExports<TGatewaySharedData>;
  reducers: TReducersBackendExports;
};

/**
 * Gateway Module Backend Implementation
 * Built-in module implementation in app-gateway
 */
export const moduleBackend: TModule<TRequired, TGatewayExports> = {
  name: 'gateway',
  version: '0.0.1',
  description: 'Gateway module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports, moduleExports, config }) => {
    depsExports.collab.collab.loadSharedData('map', 'gateway', 'gateway');
    depsExports.reducers.loadReducers(
      new GatewayReducer({
        collab: depsExports.collab,
        gateway: {} as TGatewayExports, // Will be set after moduleExports
      })
    );

    const gatewayConfig = config as GatewayModuleConfig;

    // Create centralized Ganymede client
    const ganymedeClient = createGanymedeClient(
      gatewayConfig.organization_token
    );

    // toGanymede function for backward compatibility with gateway module exports
    const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
      // Ensure pathParameters are preserved
      request.pathParameters = {
        ...request.pathParameters,
      };
      return ganymedeClient.request<T>(request);
    };

    // Register gateway module permissions
    const permissionRegistry = gatewayConfig.permissionRegistry;
    permissionRegistry.register('gateway:[permissions:*]:read', {
      resourcePath: 'permissions:*',
      action: 'read',
      description: 'Read permissions',
    });
    permissionRegistry.register('gateway:[permissions:*]:write', {
      resourcePath: 'permissions:*',
      action: 'write',
      description: 'Write permissions',
    });

    const myExports: TGatewayExports = {
      toGanymede,

      updateReverseProxy: async (
        services: { host: string; ip: string; port: number }[]
      ) => {
        // Input format: fqdn ip port (one per line)
        // Each service has a distinct FQDN (uc-{uuid}.org-{uuid}.domain.local)
        const config = services
          .map((s) => `${s.host} ${s.ip} ${s.port}\n`)
          .join('');
        log(EPriority.Info, 'GATEWAY', 'update-nginx-locations', config);
        runScript('update-nginx-locations', config);
      },

      gatewayFQDN: gatewayConfig.gatewayFQDN,

      organization_id: gatewayConfig.organization_id,

      tokenManager: gatewayConfig.tokenManager,
      permissionManager: gatewayConfig.permissionManager,
      oauthManager: gatewayConfig.oauthManager,
      dnsManager: new DNSManagerImpl(toGanymede),
      permissionRegistry: gatewayConfig.permissionRegistry,
      protectedServiceRegistry: gatewayConfig.protectedServiceRegistry,
    };

    moduleExports(myExports);
  },
};

//

type EScripts = 'update-nginx-locations' | 'reset-gateway';

export const runScript = (name: EScripts, inputString?: string) => {
  // Scripts are at /opt/gateway/app/ (standard app location in containers)
  // In dev: extracted from build tarball
  // In prod: built into image at same location
  const GATEWAY_ROOT = process.env.GATEWAY_ROOT || '/opt/gateway';
  const SCRIPTS_DIR = `${GATEWAY_ROOT}/app`;
  const cmd = `${SCRIPTS_DIR}/main.sh`;
  const args = ['-r', `bin/${name}.sh`];

  const fcmd = `${cmd} ${args.join(' ')}`;

  let output;

  try {
    const result = spawnSync(
      cmd,
      args,
      inputString ? { input: inputString } : undefined
    );
    if (result.error) {
      throw new Error(`Error executing [${fcmd}]: ${result.error.message}`);
    }
    output = result.stdout.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error(`Error executing [${fcmd}]: ${err.message}`);
  }
  let json;
  try {
    json = JSON.parse(output);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    throw new Error(
      `Error executing [${fcmd}]: not a JSON output [[[${output}]]]`
    );
  }
  if (json.status === 'error') {
    throw new Error(`Error executing script [${name}]: ${json.error}`);
  } else if (json.status === 'ok') return json as TJson;
  else
    throw new Error(
      `Error executing [${fcmd}]: invalid output status format [${json.status}]`
    );
};
