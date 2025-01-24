import { Request } from '../Request/Request';
import { TJson } from '@monorepo/simple-types';
import { Inputs } from './Inputs';

export abstract class InputSource {
  _inputs: Inputs;

  constructor(i: Inputs) {
    this._inputs = i;
  }

  abstract get(
    type: string,
    id: string[],
    r?: Request
  ): TJson | null | Promise<TJson | null> | undefined;

  abstract get types(): string[];
}
