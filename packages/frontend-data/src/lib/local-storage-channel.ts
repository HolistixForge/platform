import { browserLog } from './browser-log';

//

const debug = (key: string, msg: string, ...args: unknown[]) =>
  browserLog('debug', 'LOCAL_STORAGE_CHANNEL', `[${key}]: ${msg}`, {
    data: { key, args },
  });

//

export type StorageListener<T = unknown> = (value: T | null) => void;

//

/**
 * Low-level abstraction for localStorage with cross-tab event coordination.
 *
 * This class uses TWO event types to achieve full cross-tab + same-tab coordination:
 *
 * 1. 'storage' (browser native) - fires in OTHER tabs when localStorage changes
 * 2. 'local-storage-store' (custom) - fires in THIS tab when we write to localStorage
 *
 * The dual-event pattern is necessary because the browser's 'storage' event
 * deliberately does NOT fire in the tab that made the change.
 */
export class LocalStorageChannel {
  //
  private _prefix: string;

  constructor(prefix = 'lss:') {
    this._prefix = prefix;
  }

  //

  public key(rawKey: string): string {
    return `${this._prefix}${rawKey}`;
  }

  //

  public read<T = unknown>(rawKey: string): T | null {
    const key = this.key(rawKey);
    const ls = localStorage.getItem(key);
    if (!ls) return null;
    try {
      const value = JSON.parse(ls) as T;
      debug(key, 'read', value);
      return value;
    } catch (err) {
      debug(key, 'read error', err);
      return null;
    }
  }

  //

  public write<T = unknown>(rawKey: string, value: T): void {
    const key = this.key(rawKey);
    debug(key, 'write', value);
    const json = JSON.stringify(value);

    // Write to localStorage - this automatically triggers 'storage' event in OTHER tabs
    localStorage.setItem(key, json);

    // Browser's 'storage' event does NOT fire in the tab that made the change.
    // We dispatch a custom 'local-storage-store' event to notify listeners in THIS tab.
    // This ensures all tabs (including the current one) can coordinate via the same event API.
    const event = new StorageEvent('local-storage-store', {
      key,
    } as EventInit);
    window.dispatchEvent(event);
  }

  //

  public listen<T = unknown>(
    rawKey: string,
    cb: StorageListener<T>
  ): () => void {
    const key = this.key(rawKey);
    const listener = (event: Event) => {
      if ((event as StorageEvent).key === key) {
        const value = this.read<T>(rawKey);
        debug(key, 'listener triggered', value);
        cb(value);
      }
    };

    // Listen to 'storage' for changes from OTHER tabs (browser native behavior)
    window.addEventListener('storage', listener);

    // Listen to 'local-storage-store' for changes from THIS tab (our custom event)
    // This is necessary because 'storage' only fires in other tabs, not the one that made the change.
    window.addEventListener('local-storage-store', listener);

    return () => {
      window.removeEventListener('storage', listener);
      window.removeEventListener('local-storage-store', listener);
    };
  }
}
