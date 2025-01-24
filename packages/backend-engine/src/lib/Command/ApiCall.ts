import { TJson, TMyfetchRequest } from '@monorepo/simple-types';
import { myfetch } from '../utils/fetch';
import { Command, TCommandReturn } from './Command';

//

type Targs = TMyfetchRequest;
//

export class ApiCall extends Command {
  async run(args: Targs): Promise<TCommandReturn> {
    const r = await myfetch(args);
    return {
      data: r as TJson,
    };
  }
}
