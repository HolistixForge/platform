import {
  ExpressHandler,
  ApiDefinition,
  EpDefinition,
  Executor,
  CommandFactory,
  TSqlApi,
  TConnections,
  Connections,
  Inputs,
  TStart,
  myfetch,
  TCommandConfig,
  ConfigException,
} from '@monorepo/backend-engine';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';

import {} from './config.js';
import { TokenToJupyterlabUserModel } from './commands/jupyterlab-user-model.js';
import { ListScope, ValidateUserScope } from './commands/scope.js';
import { GatewayConfig } from './commands/gateway-config.js';
import { ServerCommand } from './commands/server-command.js';
import {
  Ec2InstanceCreate,
  Ec2InstanceState,
  Ec2InstanceStop,
  Ec2InstanceStart,
  Ec2InstanceDelete,
} from './commands/ec2-instance.js';

//
//

import oas from './oas30.json';

import execPipesDefinition from './exec-pipes.json';

import databases from './data-connections.json';

import sqlApi from './sql-api-pg.json';

//
//

CommandFactory.setCustomCommand((type: string, config: TCommandConfig) => {
  switch (type) {
    case 'token-to-jupyterlab-user-model':
      return new TokenToJupyterlabUserModel(config);
    case 'list-scope':
      return new ListScope(config);
    case 'validate-scope':
      return new ValidateUserScope(config);
    case 'gateway-config':
      return new GatewayConfig(config);
    case 'server-command':
      return new ServerCommand(config);
    case 'ec2-instance-create':
      return new Ec2InstanceCreate(config);
    case 'ec2-instance-state':
      return new Ec2InstanceState(config);
    case 'ec2-instance-stop':
      return new Ec2InstanceStop(config);
    case 'ec2-instance-start':
      return new Ec2InstanceStart(config);
    case 'ec2-instance-delete':
      return new Ec2InstanceDelete(config);
  }
  throw new ConfigException('invalid command');
});

//
//

//
//

export const main = async () => {
  const apiDefinition = new ApiDefinition(oas as any);

  const epDefinition = new EpDefinition(execPipesDefinition as any);

  const inputs = new Inputs({});

  const executor = new Executor(apiDefinition, epDefinition, inputs);

  const _db = (await executor._inputs.cloneEvalArgs(databases)) as TConnections;
  _db['pg-1'].api = sqlApi as TSqlApi;
  const connections = new Connections(_db);
  executor.setConnections(connections);

  //
  //

  const bindings: TStart[] = JSON.parse(
    (await executor._inputs.cloneEvalArgs(
      '{env.GANYMEDE_SERVER_BIND}'
    )) as string
  );

  const eh = new ExpressHandler(executor, apiDefinition, {
    openApiValidator: {
      apiSpec: oas as OpenAPIV3.DocumentV3,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ignorePaths: (path: string) => {
        return false;
      },
    },
    basicExpressApp: {
      jaeger: process.env.JAEGER_FQDN
        ? {
            serviceName: 'demiurge',
            serviceTag: 'ganymede',
            host: process.env.JAEGER_FQDN,
          }
        : undefined,
    },
  });

  bindings.forEach((b) => {
    eh.start(b);
  });

  // TODO_DEM: delete if fixed by ajv: ajv lib issue workaround,
  // when first request is one with pathParameters, openapi spec validation fail within ajv lib
  // (required field must be 'array')
  // else, openapi spec compilation is fine.
  myfetch({
    url: `http://localhost:${bindings[0].port}/jupyterlab`,
    method: 'GET',
  });
};

main();
