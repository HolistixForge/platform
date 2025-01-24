import { Command, TCommandReturn } from './Command';
import { TJson } from '@monorepo/simple-types';

export class TestCommand extends Command {
  async run(args: TJson): Promise<TCommandReturn> {
    return {
      data: {
        'test-result': {
          received: args,
        },
      },
    };
  }
}
