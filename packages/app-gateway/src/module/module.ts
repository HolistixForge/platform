import { spawnSync } from 'child_process';
import { TJson } from '@holistix-forge/simple-types';
import { EPriority, log } from '@holistix-forge/log';
import type { TModule } from '@holistix-forge/module';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import { TReducersBackendExports } from '@holistix-forge/reducers';
import { TCollabBackendExports } from '@holistix-forge/collab';
import type {
  TGatewayExports,
  TGatewayEnvironment,
} from '@holistix-forge/gateway';

import { GatewayReducer } from './gateway-reducer';
import type { PermissionManager, TokenManager } from '@holistix-forge/gateway';
import { createGanymedeClient } from '../lib/ganymede-client';

/**
 * Gateway Module Configuration
 * Passed to gateway module load() function
 */
import { PermissionRegistry } from '@holistix-forge/gateway';

export type GatewayModuleConfig = {
  organization_id: string;
  organization_token: string;
  gateway_id: string;
  gatewayFQDN: string;
  ganymedeFQDN: string;
  gatewayToken: string;
  permissionManager: PermissionManager;
  tokenManager: TokenManager;
  permissionRegistry: PermissionRegistry;
  /**
   * Values from the real environment, for modules that cannot read it.
   *
   * Module packages are bundled with a browser `process` shim, so `process.env`
   * inside one is an empty object at runtime. This file still has the real
   * `process`, which makes it the boundary.
   */
  environment: TGatewayEnvironment;
};

type TRequired = {
  collab: TCollabBackendExports;
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
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'gateway', 'gateway');

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

    // toGanymedeInternal uses X-Gateway-Token header for internal API routes
    const toGanymedeInternal = async <T>(
      request: TMyfetchRequest
    ): Promise<T> => {
      request.headers = {
        ...request.headers,
        'x-gateway-token': gatewayConfig.gatewayToken,
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

    // Last published services per project. The nginx config file belongs to the
    // gateway, the callers belong to projects, and this is where the two meet.
    const reverseProxyByProject = new Map<
      string,
      { host: string; ip: string; port: number }[]
    >();

    const myExports: TGatewayExports = {
      toGanymede,
      toGanymedeInternal,

      updateReverseProxy: async (
        projectId: string,
        services: { host: string; ip: string; port: number }[]
      ) => {
        // The script rewrites the whole file, but callers only ever know about
        // their own project. Holding the last state of each one and writing the
        // union is what keeps two projects on the same gateway from erasing
        // each other — before this, a project with no containers wiped every
        // route on the gateway about 130ms after they were written, and the
        // container was unreachable while running perfectly.
        reverseProxyByProject.set(projectId, services);

        // Input format: fqdn ip port (one per line)
        // Each service has a distinct FQDN (uc-{uuid}.org-{uuid}.domain.local)
        const config = Array.from(reverseProxyByProject.values())
          .flat()
          .map((s) => `${s.host} ${s.ip} ${s.port}\n`)
          .join('');
        log(EPriority.Info, 'GATEWAY', 'update-nginx-locations', config);
        runScript('update-nginx-locations', config);
      },

      recordVpnCredentials: async (
        entries: { user_container_id: string; token: string }[]
      ) => {
        // The whole set, not a diff, for the same reason updateReverseProxy
        // writes the union: the gateway holds the truth about which containers
        // it started, and a credential for one it no longer knows about is one
        // nobody can account for.
        runScript(
          'update-vpn-credentials',
          entries.map((e) => `${e.user_container_id} ${e.token}\n`).join('')
        );
      },

      gatewayFQDN: gatewayConfig.gatewayFQDN,

      environment: gatewayConfig.environment,

      organization_id: gatewayConfig.organization_id,

      tokenManager: gatewayConfig.tokenManager,
      permissionManager: gatewayConfig.permissionManager,
      permissionRegistry: gatewayConfig.permissionRegistry,
    };

    moduleExports(myExports);
  },
};

//

type EScripts =
  | 'update-nginx-locations'
  | 'update-vpn-credentials'
  | 'reset-gateway';

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
