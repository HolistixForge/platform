import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';

import {
  ExpressHandler,
  ApiDefinition,
  EpDefinition,
  Executor,
  Inputs,
  TStart,
  Command,
  CommandFactory,
  TCommandReturn,
  TCommandConfig,
} from '@monorepo/backend-engine';
import { TJson } from '@monorepo/simple-types';
import { log, NotFoundException } from '@monorepo/log';
import { BackendEventProcessor } from '@monorepo/collab-engine';

import { TAllEvents } from './build-collab';
import { TProjectConfig, VPN } from './project-config';
import { ROOM_ID, startProjectCollab } from './main';

//

import oas from './oas30.json';

import execPipesDefinition from './exec-pipes.json';

class ReduceEventCommand extends Command {
  _bep: BackendEventProcessor<TAllEvents, any>;

  constructor(
    config: TCommandConfig,
    d: BackendEventProcessor<TAllEvents, any>
  ) {
    super(config);
    this._bep = d;
  }

  async run(args: {
    event: TAllEvents;
    authorizationHeader: string;
    user_id: string;
    jwt: TJson;
    ip: string;
  }): Promise<TCommandReturn> {
    if (this._bep._sharedTypes) {
      const { event, authorizationHeader, user_id, jwt, ip } = args;
      await this._bep.process(event, {
        authorizationHeader,
        jwt,
        ip,
        user_id,
      });
    } else throw new NotFoundException([{ message: 'collab data not binded' }]);

    return {};
  }
}

//
//

class StartCollabCommand extends Command {
  async run(args: { config: TProjectConfig }): Promise<TCommandReturn> {
    //
    const { config } = args;

    log(6, 'GATEWAY', 'StartCollabCommand', { config });

    if (config.GANYMEDE_API_TOKEN) {
      startProjectCollab(config);
    }

    return {};
  }
}

//
//

class SendVPNConfigCommand extends Command {
  async run(): Promise<TCommandReturn> {
    return {
      data: {
        ...VPN,
        config: `client
      dev tun
      proto udp
      remote GATEWAY_HOSTNAME ${VPN!.port}
      resolv-retry infinite
      nobind
      cipher AES-256-GCM
      cert clients.crt
      key clients.key
      ca ca.crt
      tls-client
      tls-auth ta.key 1
      # verb 5`,
      },
    };
  }
}

//
//

class RoomIdCommand extends Command {
  async run(): Promise<TCommandReturn> {
    return { data: ROOM_ID };
  }
}

//
//

export const startEventsReducerServer = async (
  dispatcher: BackendEventProcessor<TAllEvents, any>,
  reducerServerBind: TStart[]
) => {
  CommandFactory.setCustomCommand((type: string, config) => {
    switch (type) {
      case 'reduce-event':
        return new ReduceEventCommand(config, dispatcher);
      case 'start-collab':
        return new StartCollabCommand(config);
      case 'send-vpn-config':
        return new SendVPNConfigCommand(config);
      case 'room-id':
        return new RoomIdCommand(config);
    }

    return null;
  });

  const apiDefinition = new ApiDefinition(oas);

  const epDefinition = new EpDefinition(execPipesDefinition as any);

  const inputs = new Inputs({});

  const executor = new Executor(apiDefinition, epDefinition, inputs);

  //
  //

  const eh = new ExpressHandler(executor, apiDefinition, {
    openApiValidator: { apiSpec: oas as OpenAPIV3.DocumentV3 },
    basicExpressApp: {
      jaeger: process.env.JAEGER_FQDN
        ? {
            serviceName: 'demiurge',
            serviceTag: 'collab',
            host: process.env.JAEGER_FQDN,
          }
        : undefined,
    },
  });

  return reducerServerBind.map((b) => eh.start(b));
};
