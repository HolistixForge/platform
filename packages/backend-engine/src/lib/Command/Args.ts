import { Command, TCommandReturn } from './Command';

//

export class Args extends Command {
  async run(args: TCommandReturn): Promise<TCommandReturn> {
    return args;
  }
}
