import { TJson } from '@monorepo/simple-types';

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
    const m = this._ydoc.getMap<T>(name);
    return m;
  }

  //

  getSharedArray<T extends TJson>(name?: string): SharedArray<T> {
    const a = this._ydoc.getArray<T>(name);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    a.deleteMatching = (f) => yarrayDeleteMatching(a, f);
    (a as any).filter = (f: any) => a.toArray().filter(f);
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
