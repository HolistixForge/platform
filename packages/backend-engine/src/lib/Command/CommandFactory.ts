import { DeepReadonly } from 'ts-essentials';
import { EpDefinitionException } from '../Exceptions/Exception';
import { Command } from './Command';
import { ApiCall } from './ApiCall';
import { TestCommand } from './TestCommand';
import { Scrap } from './Scrap';
import { AuthorizationControl } from './authorization-control';
import { Redirection } from './Redirection';
import { Connections } from '../databases/sql/Connections';
import { SqlQuery } from './SqlQuery';
import { Args } from './Args';
import { Inputs } from '../InputSource/Inputs';
import { Request } from '../Request/Request';

export type TCommandConfig = {
  connections: DeepReadonly<Connections>;
  inputs: Inputs;
  request: Request;
};

//
//

export class CommandFactory {
  static customCommands:
    | ((type: string, config: TCommandConfig) => Command | null)
    | null = null;

  static setCustomCommand(
    c: (type: string, config: TCommandConfig) => Command | null
  ) {
    CommandFactory.customCommands = c;
  }

  static get(type: string, config: TCommandConfig): Command {
    switch (type) {
      case 'test-command':
        return new TestCommand(config);

      case 'api-call':
        return new ApiCall(config);

      case 'scrap':
        return new Scrap(config);

      case 'args':
        return new Args(config);

      case 'redirection':
        return new Redirection(config);

      case 'sql-query':
        return new SqlQuery(config);

      case 'authorization-control':
        return new AuthorizationControl(config);

      default:
        if (CommandFactory.customCommands) {
          const c = CommandFactory.customCommands(type, config);
          if (c) return c;
        }
        throw new EpDefinitionException(`no such command [${type}]`);
    }
  }
}
