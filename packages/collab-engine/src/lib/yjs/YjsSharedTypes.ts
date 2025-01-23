import { SharedTypes, SharedArray, SharedMap } from '../SharedTypes';
import * as Y from 'yjs';

//
//

export class YjsSharedTypes extends SharedTypes {
  //

  _ydoc: Y.Doc;

  //
  //

  constructor(doc: Y.Doc) {
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

  getSharedMap<T>(name?: string): SharedMap<T> {
    const m = this._ydoc.getMap<T>(name);
    return m;
  }

  //

  getSharedArray<T>(name?: string): SharedArray<T> {
    const a = this._ydoc.getArray<T>(name);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    a.deleteMatching = (f) => yarrayDeleteMatching(a, f);
    return a as unknown as SharedArray<T>;
  }
}

//

const yarrayDeleteMatching = <T>(ya: Y.Array<T>, f: (v: T) => boolean) => {
  for (let i = ya.length - 1; i >= 0; i--) {
    const item = ya.get(i);
    if (f(item)) {
      ya.delete(i, 1);
    }
  }
};
