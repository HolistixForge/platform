import { TJson } from '@monorepo/simple-types';
import { Command, TCommandReturn } from './Command';

export class TestCommand extends Command {
  async run(args: object): Promise<TCommandReturn> {
    return {
      data: {
        'test-result': {
          received: args as TJson,
        },
      },
    };
  }
}
