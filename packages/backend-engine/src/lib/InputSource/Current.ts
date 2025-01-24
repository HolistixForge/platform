import { Request } from '../Request/Request';
import { InputSource } from './InputSource';
import { TJson } from '@monorepo/simple-types';

export class Current extends InputSource {
  get types() {
    return ['current'];
  }

  get(type: string, id: string[], r?: Request): TJson | undefined {
    if (!r || !r._response._jsonBody) return undefined;

    switch (type) {
      case 'current':
        return r._response._jsonBody.get(id, false);
    }
    return undefined;
  }
}
