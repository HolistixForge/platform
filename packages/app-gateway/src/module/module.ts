import { spawnSync } from 'child_process';
import { TJson } from '@monorepo/simple-types';
import { log } from '@monorepo/log';
import type { TModule } from '@monorepo/module';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { myfetch } from '@monorepo/backend-engine';
import { TReducersBackendExports } from '@monorepo/reducers';
import { TCollabBackendExports } from '@monorepo/collab';
import type {
  TGatewayExports,
  TGatewaySharedData,
} from '@monorepo/gateway';

import { GatewayReducer } from './gateway-reducer';
import type {
  PermissionManager,
  OAuthManager,
  TokenManager,
  DNSManager,
} from '@monorepo/gateway';
import { DNSManagerImpl } from '../dns/DNSManager';

/**
 * Gateway Module Configuration
 * Passed to gateway module load() function
 */
export type GatewayModuleConfig = {
  organization_id: string;
  organization_token: string;
  gateway_id: string;
  gatewayFQDN: string;
  ganymedeFQDN: string;
  gatewayToken: string;
  gatewayScriptsDir: string;
  permissionManager: PermissionManager;
  oauthManager: OAuthManager;
  tokenManager: TokenManager;
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

    const ganymede_api = `https://${gatewayConfig.ganymedeFQDN}`;

    const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
      if (!request.headers?.authorization) {
        request.headers = {
          ...request.headers,
          authorization: gatewayConfig.organization_token,
        };
      }
      request.url = `${ganymede_api}${request.url}`;
      request.pathParameters = {
        ...request.pathParameters,
      };
      const response = await myfetch(request);
      log(6, 'GATEWAY', `${request.url} response: ${response.statusCode}`);
      if (response.statusCode !== 200) {
        const error = new Error(
          `Request to ${request.url} failed with status ${response.statusCode}`
        );
        throw error;
      }

      return response.json as T;
    };

    type EScripts = 'update-nginx-locations' | 'reset-gateway';

    const runScript = (name: EScripts, inputString?: string) => {
      const DIR = gatewayConfig.gatewayScriptsDir;
      const cmd = `${DIR}/main.sh`;
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

    const myExports: TGatewayExports = {
      toGanymede,

      updateReverseProxy: async (
        services: { host: string; ip: string; port: number }[]
      ) => {
        const config = services
          .map((s) => `${s.host} ${s.ip} ${s.port}\n`)
          .join('');
        throw new Error('fix update-nginx-locations script');
        runScript('update-nginx-locations', config);
      },

      gatewayFQDN: gatewayConfig.gatewayFQDN,

      organization_id: gatewayConfig.organization_id,

      tokenManager: gatewayConfig.tokenManager,
      permissionManager: gatewayConfig.permissionManager,
      oauthManager: gatewayConfig.oauthManager,
      dnsManager: new DNSManagerImpl(toGanymede),
    };

    moduleExports(myExports);

    // Update GatewayReducer with actual gateway exports
    // This is a bit hacky but necessary since reducer needs gateway exports
    const reducer = depsExports.reducers as any;
    const reducers = reducer._reducers || [];
    for (const r of reducers) {
      if (r instanceof GatewayReducer) {
        (r as any).depsExports.gateway = myExports;
      }
    }
  },
};

