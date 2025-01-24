import { Command, TCommandReturn } from '@monorepo/backend-engine';

import { serverAccessScope } from '@monorepo/demiurge-types';

//
//
//

export class TokenToJupyterlabUserModel extends Command {
  async run(args: {
    client_id: string;
    scope: string[];
    username: string;
  }): Promise<TCommandReturn> {
    const scopes: string[] = [];

    if (args.scope.includes(serverAccessScope(args.client_id)))
      scopes.push(
        `access:servers!server=${args.client_id}/`,
        `read:users:groups!user=${args.client_id}`,
        `read:users:name!user=${args.client_id}`
      );

    return {
      data: {
        name: args.username,
        kind: 'user',
        admin: false,
        groups: [],
        scopes,
      },
    };
  }
}
