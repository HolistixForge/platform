import { TStringMap } from '../Request/Request';
import { TCookie } from '../Response/Response';
import { TCommandConfig } from './CommandFactory';
import { TJson, TUri } from '@monorepo/simple-types';

export type TCommandReturn = {
  data?: TJson;
  cookies?: Array<TCookie>;
  redirect?: TUri;
  headers?: TStringMap;
  serverSentEvents?: string[];
};

export abstract class Command {
  _config: TCommandConfig;

  constructor(config: TCommandConfig) {
    this._config = config;
  }

  abstract run(args: TJson): Promise<TCommandReturn>;
}
