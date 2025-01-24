import { Command, TCommandReturn } from '@monorepo/backend-engine';
import { USER_SCOPE } from '@monorepo/demiurge-types';
import { TJson } from '@monorepo/simple-types';

//

export class ListScope extends Command {
  async run(): Promise<TCommandReturn> {
    return {
      data: USER_SCOPE as unknown as TJson,
    };
  }
}

export class ValidateUserScope extends Command {
  async run(args: { scope: string[] }): Promise<TCommandReturn> {
    const validated = args.scope.filter((s) => USER_SCOPE.includes(s));
    return {
      data: { tojson: JSON.stringify(validated) },
    };
  }
}
