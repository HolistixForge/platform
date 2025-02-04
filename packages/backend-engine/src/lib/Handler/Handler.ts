import { Executor } from '../Executor/Executor.js';
import { ApiDefinition } from '../ApiDefinition/ApiDefinition';

export abstract class Handler {
  _executor: Executor;
  _apiDefinition: ApiDefinition;

  constructor(e: Executor, d: ApiDefinition) {
    this._executor = e;
    this._apiDefinition = d;
  }

  abstract start(config: any): void;
}
