import { TStringMap } from '@monorepo/simple-types';

import { Request } from '../Request/Request';
import { InputSource } from './InputSource';

export class PathAndQuery extends InputSource {
  get types() {
    return ['path', 'query'];
  }

  get(
    type: string,
    id: string[],
    r?: Request
  ): string | TStringMap | undefined {
    if (!r || !r._data.getParameters) return undefined;

    let v: string | TStringMap | undefined = undefined;

    if (!v) {
      switch (type) {
        case 'query':
          if (id[0] === '*') v = r._data.getParameters;
          else v = r._data.getParameters[id[0]];
          break;
        case 'path':
          if (id[0] === '*') v = r._data.pathParameters;
          else v = r._data.pathParameters[id[0]];
          break;
      }
      if (v) {
        if (typeof v === 'string') v = decodeURIComponent(v);
        else {
          for (const prop in v) {
            v[prop] = decodeURIComponent(v[prop]);
          }
        }
      }
    }
    return v;
  }
}
