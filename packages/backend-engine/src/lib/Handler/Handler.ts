import { Executor } from '../Executor/Executor.js';
import { ApiDefinition } from '../ApiDefinition/ApiDefinition';

export abstract class Handler {
  _executor: Executor;
  _apiDefinition: ApiDefinition;

  constructor(e: Executor, d: ApiDefinition) {
    this._executor = e;
    this._apiDefinition = d;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract start(config: any): void;
}
