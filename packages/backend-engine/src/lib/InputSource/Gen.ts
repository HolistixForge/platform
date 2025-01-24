import { Request } from '../Request/Request';
import { InputSource } from './InputSource';
import { TJson, makeUuid } from '@monorepo/simple-types';

export class Gen extends InputSource {
  get types() {
    return ['gen'];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get(_type: string, id: string[], _r?: Request): TJson | undefined {
    switch (id[0]) {
      case 'uuid':
        return makeUuid();
    }
    return undefined;
  }
}
