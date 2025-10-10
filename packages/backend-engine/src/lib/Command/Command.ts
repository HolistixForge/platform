import { TJson, TUri, TStringMap } from '@monorepo/simple-types';

import { TCookie } from '../Response/Response';
import { TCommandConfig } from './CommandFactory';

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

  abstract run(args: object): Promise<TCommandReturn>;
}
