import { makeUuid, TJson } from '@holistix-forge/simple-types';

import { SharedTypes, SharedMap, SharedArray } from '../SharedTypes';

//

type TEvent = any;

class Observable<TO> {
  _observer: Array<TO> = [];

  observe(o: TO) {
    this._observer.push(o);
  }

  unobserve(o: TO) {
    const i = this._observer.findIndex((o2) => Object.is(o, o2));
    if (i !== -1) this._observer.splice(i, 1);
  }
}

//

class MyMap<T extends TJson>
  extends Observable<(event: TEvent) => void>
  implements SharedMap<T>
{
  _nsts: NoneSharedTypes[] = [];
  _map: Map<string, T> = new Map<string, T>();
  uuid: string;

  constructor() {
    super();
    this.uuid = makeUuid();
  }

  registerNoneSharedTypeListener(nst: NoneSharedTypes) {
    this._nsts.push(nst);
  }

  toJSON(): { [k: string]: T } {
    const obj: { [k: string]: T } = {};
    this._map.forEach((value, key) => {
      obj[key] = JSON.parse(JSON.stringify(value));
    });
    return obj;
  }

  values(): IterableIterator<T> {
    return this._map.values();
  }

  delete(k: string): void {
    this._map.delete(k);
    this._nsts.forEach((nst) => nst.flagChange(this._observer));
  }

  set(k: string, o: T): void {
    this._map.set(k, o);
    this._nsts.forEach((nst) => nst.flagChange(this._observer));
  }

  get(k: string): T {
    return this._map.get(k) as T;
  }

  map(f: (v: T, k: string) => any): any[] {
    const keys: Array<string> = Array.from(this._map.keys());
    return keys.map((k) => f(this._map.get(k) as T, k));
  }

  forEach(f: (v: T, k: string) => void): void {
    const keys: Array<string> = Array.from(this._map.keys());
    keys.forEach((k) => f(this._map.get(k) as T, k));
  }

  copy(): Map<string, T> {
    return structuredClone(this._map);
  }
}

//

class MyArray<T extends TJson>
  extends Observable<(event: TEvent) => void>
  implements SharedArray<T>
{
  _array: Array<T> = [];
  _nsts: NoneSharedTypes[] = [];

  registerNoneSharedTypeListener(nst: NoneSharedTypes) {
    this._nsts.push(nst);
  }

  filter(predicate: (value: T, index: number) => boolean): T[] {
    return this._array.filter(predicate);
  }

  toJSON(): T[] {
    return JSON.parse(JSON.stringify(this._array));
  }

  deleteMatching(f: (v: T) => boolean): void {
    for (let i = this._array.length - 1; i >= 0; i--) {
      const item = this._array[i];
      if (f(item)) {
        this._array.splice(i, 1);
      }
    }
  }

  delete(index: number, length?: number): void {
    this._array.splice(index, length);
    this._nsts.forEach((nst) => nst.flagChange(this._observer));
  }

  push(o: T[]): number {
    this._array = this._array.concat(o);
    this._nsts.forEach((nst) => nst.flagChange(this._observer));
    return this._array.length - 1;
  }

  get length(): number {
    return this._array.length;
  }

  toArray(): T[] {
    return this._array;
  }

  get(index: number): T {
    return this._array[index];
  }

  map(f: (v: T, k: number) => any): any[] {
    return this._array.map(f);
  }

  forEach(f: (v: T, k: number) => void): void {
    return this._array.forEach(f);
  }

  copy(): Array<T> {
    return structuredClone(this._array);
  }
}

//

export class NoneSharedTypes extends SharedTypes {
  private static _sharedMaps: Map<string, MyMap<any>> = new Map();
  private static _sharedArrays: Map<string, MyArray<any>> = new Map();
  _changes: Array<(e: TEvent) => void> = [];
  id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }

  flagChange(obs: Array<(e: TEvent) => void>) {
    obs.forEach((f) => {
      // if (!this._changes.includes(f)) this._changes.push(f);
      f({});
    });
  }

  async transaction(f: () => Promise<void>): Promise<void> {
    await f();
    // this._changes.forEach((o) => o({}));
    // this._changes = [];
  }

  getSharedMap<T extends TJson>(name?: string): SharedMap<T> {
    const key = `${this.id}::${name || 'default'}`;
    let map = NoneSharedTypes._sharedMaps.get(key);

    if (!map) {
      map = new MyMap<T>();
      map.registerNoneSharedTypeListener(this);
      NoneSharedTypes._sharedMaps.set(key, map);
    } else {
      map.registerNoneSharedTypeListener(this);
    }

    return map;
  }

  getSharedArray<T extends TJson>(name?: string): SharedArray<T> {
    const key = `${this.id}::${name || 'default'}`;
    let array = NoneSharedTypes._sharedArrays.get(key);

    if (!array) {
      array = new MyArray<T>();
      array.registerNoneSharedTypeListener(this);
      NoneSharedTypes._sharedArrays.set(key, array);
    } else {
      array.registerNoneSharedTypeListener(this);
    }

    return array;
  }
}
