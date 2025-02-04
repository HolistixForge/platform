//

export interface SharedArray<T> {
  push: (o: T[]) => void;
  length: number;
  toArray: () => Array<T>;
  get: (index: number) => T;

  map: (f: (v: T, k: number) => any) => Array<any>;

  observe: (event: any) => void;

  unobserve: (event: any) => void;
  forEach: (f: (v: T, k: number) => void) => void;
  delete: (index: number, length?: number) => void;
  deleteMatching: (f: (v: T) => boolean) => void;
}

//

export interface SharedMap<T> {
  delete: (k: string) => void;
  set: (k: string, o: T) => void;
  get: (k: string) => T | undefined;

  observe: (event: any) => void;

  unobserve: (event: any) => void;
  forEach: (f: (v: T, k: string) => void) => void;
}

//

export abstract class SharedTypes {
  abstract getSharedMap<T>(name?: string): SharedMap<T>;
  abstract getSharedArray<T>(name?: string): SharedArray<T>;
  abstract transaction(f: () => Promise<void>): Promise<void>;
}
