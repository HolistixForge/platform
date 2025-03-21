import {
  Command,
  ConfigException,
  TCommandReturn,
  generateJwtToken,
} from '@monorepo/backend-engine';
import {
  GATEWAY_PROJECT_SCOPE,
  makeProjectScopeString,
  TJwtProject,
} from '@monorepo/demiurge-types';
import { ONE_YEAR_MS } from '@monorepo/simple-types';

//

export class GatewayConfig extends Command {
  async run(args: {
    project_id: string;
    frontend_fqdn: string;
  }): Promise<TCommandReturn> {
    if (args.project_id) {
      const payload: TJwtProject = {
        type: 'project_token',
        project_id: args.project_id,
        scope: GATEWAY_PROJECT_SCOPE.map((s) =>
          makeProjectScopeString(args.project_id, s)
        ).join(' '),
      };

      return {
        data: {
          GANYMEDE_API_TOKEN: generateJwtToken(
            payload,
            `${ONE_YEAR_MS}` // TODO: adjust expiration ?
          ),
          PROJECT_ID: args.project_id,
        },
      };
    } else throw new ConfigException('no project_id');
  }
}

//
