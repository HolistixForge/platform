import { Request } from '../Request/Request';
import { InputSource } from './InputSource';

export class Headers extends InputSource {
  get types() {
    return ['headers'];
  }

  get(type: string, id: string[], r?: Request): string | undefined {
    if (!r || !r._data.headers) return undefined;
    const v = r._data.headers[id[0]];
    return v || undefined;
  }
}
