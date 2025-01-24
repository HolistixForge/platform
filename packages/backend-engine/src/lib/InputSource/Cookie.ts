import { JsonValue } from '../JsonValue';
import { Request } from '../Request/Request';
import { InputSource } from './InputSource';
import { TJson } from '@monorepo/simple-types';

export class Cookie extends InputSource {
  get types() {
    return ['cookie'];
  }

  get(type: string, id: string[], r?: Request): TJson | undefined {
    if (!r || !r._data.headers.cookie) return undefined;

    const cookies = r._data.headers.cookie
      .split(';')
      .map((c) => c.trim().split('='));

    const cookie = cookies.find((c) => c[0] === id[0]);

    if (cookie) {
      const decoded = decodeURIComponent(cookie[1]);

      id.shift();

      if (id[0] === 'json') {
        id.shift();
        const json = JSON.parse(decoded);

        const jv = new JsonValue(json);

        return jv.get(id);
      } else return decoded;
    } else return undefined;
  }
}
