import { TMyfetchRequest } from '@monorepo/simple-types';
import { myfetch } from '../utils/fetch';
import { Command, TCommandReturn } from './Command';

//

type Targs = TMyfetchRequest & {
  regex: string[];
};

export class Scrap extends Command {
  async run(args: Targs): Promise<TCommandReturn> {
    const result = await myfetch(args);
    console.log(`Scrap [${result.response.substring(0, 76)}...]`);

    args.regex.map((regex) => {
      const matchs = result.response.match(regex);
      console.log('Scrap', regex, 'matchs', matchs);
      // TBC...
    });

    return {};
  }
}
