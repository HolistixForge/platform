import { TJson } from '@holistix-forge/simple-types';

import { SharedTypes, SharedArray, SharedMap } from '../SharedTypes';
import { Doc, Array } from 'yjs';

//
//

export class YjsSharedTypes extends SharedTypes {
  //

  _ydoc: Doc;

  //
  //

  constructor(doc: Doc) {
    super();
    this._ydoc = doc;
  }

  //
  //
  //

  async transaction(f: () => Promise<void>): Promise<void> {
    return await this._ydoc.transact(async () => {
      return await f();
    });
  }

  //

  getSharedMap<T extends TJson>(name?: string): SharedMap<T> {
    const m = this._ydoc.getMap<T>(name) as unknown as SharedMap<T>;

    m.copy = () => {
      const copy = new Map<string, T>();
      m.forEach((value, key) => {
        copy.set(key, value);
      });
      return copy;
    };

    return m;
  }

  //

  getSharedArray<T extends TJson>(name?: string): SharedArray<T> {
    const a: SharedArray<T> = this._ydoc.getArray<T>(
      name
    ) as unknown as SharedArray<T>;

    a.deleteMatching = (f) => yarrayDeleteMatching(a as unknown as Array<T>, f);

    a.filter = (f: any) => a.toArray().filter(f);

    a.copy = () => {
      return a.toArray();
    };

    return a as unknown as SharedArray<T>;
  }
}

//

const yarrayDeleteMatching = <T>(ya: Array<T>, f: (v: T) => boolean) => {
  for (let i = ya.length - 1; i >= 0; i--) {
    const item = ya.get(i);
    if (f(item)) {
      ya.delete(i, 1);
    }
  }
};
