import { ForbiddenException } from '@monorepo/log';

import { Command, TCommandReturn } from './Command';

type TArgs = {
  type: string; // 'jwt' | 'hmac' | 'jwt,hmac';
  action: string;
  publicAction?: string; // if true, the action is public, for public projects
};

//

export class AuthorizationControl extends Command {
  //

  async run(args: TArgs): Promise<TCommandReturn> {
    const { type, action, publicAction } = args;

    let scope: string | undefined = undefined;

    if (type.includes('jwt')) {
      scope = (await this._config.inputs.evalInput(
        'jwt.scope',
        this._config.request
      )) as string;
    }

    if (!scope && type.includes('hmac')) {
      scope = (await this._config.inputs.evalInput(
        'hmac.scope',
        this._config.request
      )) as string;
    }

    if (!scope) throw new ForbiddenException([{ message: 'no scope found' }]);

    if (publicAction && scope.includes(publicAction)) {
      return Promise.resolve({});
    }

    if (!scope.includes(action))
      throw new ForbiddenException([
        { message: `insufficient scope: need [${action}], has [${scope}]` },
      ]);

    return Promise.resolve({});
  }
}
