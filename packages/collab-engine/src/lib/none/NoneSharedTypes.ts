import { TJson } from '@monorepo/simple-types';

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
  _sm: NoneSharedTypes;

  constructor(sm: NoneSharedTypes) {
    super();
    this._sm = sm;
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
  }

  _map: Map<string, T> = new Map<string, T>();

  set(k: string, o: T): void {
    this._map.set(k, o);
    this._sm.flagChange(this._observer);
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
}

//

class MyArray<T extends TJson>
  extends Observable<(event: TEvent) => void>
  implements SharedArray<T>
{
  _array: Array<T> = [];
  _sm: NoneSharedTypes;

  constructor(sm: NoneSharedTypes) {
    super();
    this._sm = sm;
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
  }

  push(o: T[]): number {
    this._array = this._array.concat(o);
    this._sm.flagChange(this._observer);
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
}

//

export class NoneSharedTypes extends SharedTypes {
  _changes: Array<(e: TEvent) => void> = [];

  flagChange(obs: Array<(e: TEvent) => void>) {
    obs.forEach((f) => {
      if (!this._changes.includes(f)) this._changes.push(f);
    });
  }

  async transaction(f: () => Promise<void>): Promise<void> {
    await f();

    if (this._changes) {
      this._changes.forEach((o) => o({}));
    }

    this._changes = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSharedMap<T extends TJson>(name?: string): SharedMap<T> {
    return new MyMap<T>(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSharedArray<T extends TJson>(name?: string): SharedArray<T> {
    return new MyArray<T>(this);
  }
}
