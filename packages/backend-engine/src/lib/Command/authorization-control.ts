import { Command, TCommandReturn } from './Command';
import { ForbiddenException } from '../Exceptions/Exception';

type TArgs = {
  type: string; // 'jwt' | 'hmac' | 'jwt,hmac';
  action: string;
};

//

export class AuthorizationControl extends Command {
  //

  async run(args: TArgs): Promise<TCommandReturn> {
    const { type, action } = args;

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

    console.log(scope);

    if (!scope.includes(action))
      throw new ForbiddenException([
        { message: `insufficient scope: need [${action}]` },
      ]);

    return Promise.resolve({});
  }
}
