//

import { TJson } from '@holistix/shared-types';

//

export interface SharedArray<T extends TJson> {
  push: (o: T[]) => void;
  length: number;
  toArray: () => Array<T>;
  get: (index: number) => T;

  map: (f: (v: T, k: number) => any) => Array<any>;
  filter: (predicate: (value: T, index: number) => boolean) => T[];

  observe: (event: any) => void;

  unobserve: (event: any) => void;
  forEach: (f: (v: T, k: number) => void) => void;
  delete: (index: number, length?: number) => void;
  deleteMatching: (f: (v: T) => boolean) => void;
  toJSON: () => Array<T>;
  copy: () => Array<T>;
}

//
export interface SharedMap<T extends TJson> {
  delete: (k: string) => void;
  set: (k: string, o: T) => void;
  get: (k: string) => T | undefined;

  observe: (event: any) => void;

  unobserve: (event: any) => void;
  forEach: (f: (v: T, k: string) => void) => void;
  values(): IterableIterator<T>;
  toJSON: () => { [k: string]: T };
  copy: () => Map<string, T>;
}

//

export abstract class SharedTypes {
  abstract getSharedMap<T extends TJson>(name?: string): SharedMap<T>;
  abstract getSharedArray<T extends TJson>(name?: string): SharedArray<T>;
  abstract transaction(f: () => Promise<void>): Promise<void>;
}
