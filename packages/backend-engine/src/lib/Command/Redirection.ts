import { TUri } from '@monorepo/simple-types';
import { Command, TCommandReturn } from './Command';

type TRedirectionArgs = TUri;

export class Redirection extends Command {
  async run(args: TRedirectionArgs): Promise<TCommandReturn> {
    return {
      redirect: args,
    };
  }
}
