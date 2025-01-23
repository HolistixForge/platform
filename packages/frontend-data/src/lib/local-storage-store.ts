import { log } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debug = (k: Key, msg: string, ...args: any) =>
  log(7, 'LOCAL_STORAGE_STORE', `[${keyHash(k)}]: ${msg}`, ...args);

//

export type Key = TJson;

//

type LSSOptions<T> = {
  get: (k: Key) => Promise<{ value: T; expire: Date } | null>;
  refresh: (k: Key, t: T) => Promise<{ value: T; expire: Date } | null>;
};

//

type Get<T> =
  | {
      value: T;
      promise: undefined;
    }
  | { value: null; promise: Promise<void> };

//

type NoValue = {
  value: undefined;
  pending: true;
  wait: number;
  expire: undefined;
};
type WithValue<T> = {
  value: T;
  pending: boolean;
  wait?: number;
  expire: Date;
};
type AnError = {
  error: true;
  wait: number;
};

type Deserialized<T> = NoValue | AnError | WithValue<T>;

//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deserialize = <T>(o: any): Deserialized<T> => {
  return {
    ...o,
    expire: o.expire ? new Date(o.expire) : undefined,
  };
};

//
// JSON.stringify replacer function for having object keys sorted in output
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replacer = (key: string, value: any) =>
  value instanceof Object && !(value instanceof Array)
    ? Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, {} as any)
    : value;

const keyHash = (k: Key) => JSON.stringify(k, replacer);

//

type Status =
  | { error: true; pending: boolean; valid: false }
  | { error: false; missing: true; pending: boolean; valid: false }
  | {
      error: false;
      missing: false;
      pending: boolean;
      expiredSoon: boolean;
      expired: false;
      valid: true;
    }
  | {
      error: false;
      missing: false;
      pending: boolean;
      expiredSoon: boolean;
      expired: true;
      valid: false;
    };

//

const SOON = 1000 * 60 * 5; // 5 minutes

const ERROR_WAIT = 1000 * 30; // 30 secondes

//

export class LocalStorageStore<T> {
  private _options: LSSOptions<T>;
  private _usedKeys: string[];

  constructor(options: LSSOptions<T>) {
    this._options = options;
    this._usedKeys = [];
  }

  //

  private read = <T>(k: Key): Deserialized<T> | null => {
    const key = keyHash(k);
    if (!this._usedKeys.includes(key)) this._usedKeys.push(key);
    const ls = localStorage.getItem(keyHash(k));
    if (!ls) return null;
    const ser = JSON.parse(ls);
    return deserialize<T>(ser);
  };

  //

  private write = <T>(k: Key, value: Deserialized<T>): void => {
    debug(k, `write`, value);
    const json = JSON.stringify(value);
    const key = keyHash(k);
    // fire other tab/window 'storage' event
    localStorage.setItem(key, json);
    const event = new StorageEvent('local-storage-store', {
      key,
    } as EventInit);
    window.dispatchEvent(event);
  };

  //

  private status = (o: Deserialized<T> | null): Status => {
    // null
    if (o === null)
      return { missing: true, pending: false, valid: false, error: false };
    // error or stuck in pending state
    else if (
      (o as AnError).error ||
      ((o as WithValue<T>).pending && o.wait && o.wait < new Date().getTime())
    )
      return {
        error: true,
        pending: (o as WithValue<T>).pending || false,
        valid: false,
      };
    // pending, no value
    else if ((o as NoValue).pending && (o as WithValue<T>).value === undefined)
      return { missing: true, pending: true, valid: false, error: false };
    // value exists, expired
    else if (new Date().getTime() >= (o as WithValue<T>).expire.getTime())
      return {
        error: false,
        missing: false,
        pending: (o as WithValue<T>).pending,
        valid: false,
        expired: true,
        expiredSoon: false,
      };
    // value exists, expire soon
    else if (
      new Date().getTime() + SOON >=
      (o as WithValue<T>).expire.getTime()
    )
      return {
        error: false,
        missing: false,
        pending: (o as WithValue<T>).pending,
        valid: true,
        expired: false,
        expiredSoon: true,
      };
    // value exist, valid, no expiration soon
    else
      return {
        error: false,
        missing: false,
        pending: (o as WithValue<T>).pending,
        valid: true,
        expired: false,
        expiredSoon: false,
      };
  };

  //

  private makePromise = (k: Key): Promise<void> => {
    debug(k, `makePromise`);
    const promise = new Promise<void>((resolve) => {
      const listener = (event: Event) => {
        if ((event as StorageEvent).key === keyHash(k)) {
          debug(k, `wait promise resolved`);
          window.removeEventListener('storage', listener);
          window.removeEventListener('local-storage-store', listener);
          resolve();
        }
      };
      window.addEventListener('storage', listener);
      window.addEventListener('local-storage-store', listener);
    });
    return promise;
  };

  //

  private update = (k: Key, r: { value: T; expire: Date } | null): void => {
    debug(k, `update`);
    if (r) {
      const { value, expire } = r;
      this.write(k, { value, expire, pending: false, wait: undefined });
    } else {
      this.write(k, { error: true, wait: new Date().getTime() + ERROR_WAIT });
    }
  };

  //

  private start = (k: Key): void => {
    debug(k, `start`);
    this._options.get(k).then((r) => this.update(k, r));
  };

  //

  private refresh = (k: Key, value: T): void => {
    debug(k, `refresh`);
    this._options.refresh(k, value).then((r) => this.update(k, r));
  };

  //

  private setPending = (k: Key, o: WithValue<T> | NoValue | null): void => {
    debug(k, `setPending`);
    const wait = new Date().getTime() + 10 * 1000; // 10 secondes
    if (o === null)
      o = {
        pending: true,
        wait,
        value: undefined,
        expire: undefined,
      };
    o.pending = true;
    o.wait = wait;
    this.write(k, o);
  };

  //

  /**
   * check if it is still flagged as error, and restart if it is
   * (may have been done yet in other context/tab/window)
   * @param k
   */
  private restartAfterError = (k: Key) => {
    debug(k, `restartAfterError`);
    const o = this.read<T>(k);
    const status = this.status(o);
    if (status.error) {
      this.start(k);
    }
  };

  //

  public get = (k: Key): Get<T> => {
    const o = this.read<T>(k);
    const status = this.status(o);
    debug(k, `get`, { object: o, status });

    let promise: Promise<void> | null = null;

    if (status.error) {
      promise = this.makePromise(k);
      setTimeout(() => {
        this.restartAfterError(k);
      }, (o as AnError).wait - new Date().getTime());
    }
    //
    else if (status.missing) {
      if (!status.pending) {
        this.setPending(k, o as NoValue | null);
        promise = this.makePromise(k);
        this.start(k);
      }
    }
    // //  !status.missing
    else {
      if ((status.expiredSoon || status.expired) && !status.pending) {
        this.setPending(k, o as WithValue<T>);
        promise = this.makePromise(k);
        this.refresh(k, (o as WithValue<T>).value);
      }
    }

    if (status.valid)
      return { value: (o as WithValue<T>).value, promise: undefined };
    else {
      if (promise === null)
        // example: missing and pending
        promise = this.makePromise(k);
      return { value: null, promise };
    }
  };

  //

  public reset = (): void => {
    this._usedKeys.forEach((key) => localStorage.removeItem(key));
  };
}
