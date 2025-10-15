import { spawnSync } from 'child_process';

import { RunException } from '@monorepo/backend-engine';
import { TJson } from '@monorepo/simple-types';
import { log } from '@monorepo/log';
import type { TModule } from '@monorepo/module';
import { TMyfetchRequest } from '@monorepo/simple-types';
import { myfetch } from '@monorepo/backend-engine';
import { ForwardException } from '@monorepo/backend-engine';
import { TReducersBackendExports } from '@monorepo/reducers';
import { TCollabBackendExports } from '@monorepo/collab';
import { TCollabFrontendExports } from '@monorepo/collab/frontend';

import { GatewayReducer } from './lib/gateway-reducer';
import { TGatewaySharedData } from './lib/gateway-types';

//

export type TGatewayExports = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  //    loadDoc: () => boolean;
  updateReverseProxy: (
    services: { location: string; ip: string; port: number }[]
  ) => Promise<void>;
  gatewayStop: () => Promise<void>;
  gatewayFQDN: string;
  project_id: string;
};

//

export type TProjectConfig = {
  GANYMEDE_API_TOKEN: string;
  PROJECT_ID: string;
};

export type TGatewayInitExtraContext = {
  project: TProjectConfig;
  config: {
    GANYMEDE_FQDN: string;
    GATEWAY_TOKEN: string;
    GATEWAY_FQDN: string;
    SCRIPTS_DIR: string;
  };
};

//

type TRequired = {
  gateway_init: TGatewayInitExtraContext;
  collab: TCollabBackendExports<TGatewaySharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

//

export const moduleBackend: TModule<TRequired, TGatewayExports> = {
  name: 'gateway',
  version: '0.0.1',
  description: 'Gateway module',
  dependencies: ['collab', 'reducers'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'gateway', 'gateway');
    depsExports.reducers.loadReducers(new GatewayReducer(depsExports));

    const gateway_init = depsExports.gateway_init;

    const ganymede_api = `https://${gateway_init.config.GANYMEDE_FQDN}`;

    const toGanymede = async <T>(request: TMyfetchRequest): Promise<T> => {
      if (!request.headers?.authorization)
        request.headers = {
          ...request.headers,
          authorization: gateway_init.project.GANYMEDE_API_TOKEN,
        };
      request.url = `${ganymede_api}${request.url}`;
      request.pathParameters = {
        ...request.pathParameters,
        project_id: gateway_init.project.PROJECT_ID,
      };
      const response = await myfetch(request);
      log(6, 'GATEWAY', `${request.url} response: ${response.statusCode}`);
      if (response.statusCode !== 200)
        throw new ForwardException(request, response);

      return response.json as T;
    };

    type EScripts = 'update-nginx-locations' | 'reset-gateway';

    //

    const runScript = (name: EScripts, inputString?: string) => {
      const DIR = gateway_init.config.SCRIPTS_DIR;
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
          throw new RunException(
            `Error executing [${fcmd}]: ${result.error.message}`
          );
        }
        output = result.stdout.toString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        throw new RunException(`Error executing [${fcmd}]: ${err.message}`);
      }
      let json;
      try {
        json = JSON.parse(output);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        throw new RunException(
          `Error executing [${fcmd}]: not a JSON output [[[${output}]]]`
        );
      }
      if (json.status === 'error') {
        throw new RunException(
          `Error executing script [${name}]: ${json.error}`
        );
      } else if (json.status === 'ok') return json as TJson;
      else
        throw new RunException(
          `Error executing [${fcmd}]: invalid output status format [${json.status}]`
        );
    };

    //
    //

    const myExports: TGatewayExports = {
      toGanymede,

      updateReverseProxy: async (
        services: { location: string; ip: string; port: number }[]
      ) => {
        const config = services
          .map((s) => `${s.location} ${s.ip} ${s.port}\n`)
          .join('');
        runScript('update-nginx-locations', config);
      },

      gatewayStop: async () => {
        log(6, 'GATEWAY', 'gatewayStop');
        await toGanymede({
          url: '/gateway-stop',
          method: 'POST',
          headers: { authorization: gateway_init.config.GATEWAY_TOKEN },
        });
        runScript('reset-gateway');
      },

      gatewayFQDN: gateway_init.config.GATEWAY_FQDN,

      project_id: gateway_init.project.PROJECT_ID,
    };

    moduleExports(myExports);
  },
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
export type { TGatewaySharedData } from './lib/gateway-types';
