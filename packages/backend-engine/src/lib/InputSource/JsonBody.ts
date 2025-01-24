import { JsonValue } from '../JsonValue';
import { Request } from '../Request/Request';
import { InputSource } from './InputSource';
import { TJson } from '@monorepo/simple-types';

export class JsonBody extends InputSource {
  get types() {
    return ['json'];
  }

  get(type: string, id: string[], r?: Request): TJson | undefined {
    if (!r || !r._data.json) return undefined;

    const jv = new JsonValue(r._data.json);
    switch (type) {
      case 'json':
        return jv.get(id, false);
    }
    return undefined;
  }
}
