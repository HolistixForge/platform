import { browserLog } from './browser-log';
import { LocalStorageChannel } from './local-storage-channel';

const debug = (key: string, msg: string, ...args: unknown[]) =>
  browserLog('debug', 'LOCAL_STORAGE_STORE', `[${key}]: ${msg}`, {
    data: { key, args },
  });

//

export type Key = string;

//

type LSSOptions<T> = {
  /**
   * Async getter used when value is missing or in error.
   * The key is a string controlled by the caller.
   */
  get: (key: string) => Promise<{ value: T; expire: Date } | null>;
  /**
   * Async refresher used when value is expiring.
   * The key is a string controlled by the caller.
   */
  refresh: (key: string, t: T) => Promise<{ value: T; expire: Date } | null>;
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

const deserialize = <T>(o: { [k: string]: unknown }): Deserialized<T> => {
  return {
    ...o,
    expire: o.expire ? new Date(o.expire as string | number | Date) : undefined,
  } as Deserialized<T>;
};

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

// How long to wait before retrying after an error
// This prevents retry storms and gives transient issues time to resolve
const ERROR_WAIT = 1000 * 30; // 30 seconds

// Jitter range for retry timing to prevent thundering herd across tabs
// When multiple tabs schedule retries, they'll fire at slightly different times
const RETRY_JITTER = 1000 * 5; // 0-5 seconds random jitter

//

/**
 * Distributed cache with cross-tab coordination and automatic error recovery.
 *
 * ERROR RECOVERY MECHANISM (Automatic & Self-Contained):
 *
 * When a fetch/refresh fails:
 * 1. Write error state to localStorage: { error: true, wait: timestamp }
 *    - wait = now + 30 seconds (ERROR_WAIT)
 *    - This coordinates retry timing across ALL tabs
 *
 * 2. Automatically schedule retry (internal, not triggered by get()):
 *    - scheduleRetry() sets timeout for ERROR_WAIT + jitter
 *    - Jitter (0-5s) prevents thundering herd across tabs
 *    - If retry already scheduled, does nothing (deduplication)
 *
 * 3. When user calls get() and sees error:
 *    - Returns promise that resolves when value becomes available
 *    - If no retry scheduled (late-joining tab), schedules one based on remaining time
 *
 * 4. When retry fires (after ~30 seconds):
 *    - restartAfterError() re-reads localStorage (another tab might have fixed it!)
 *    - If still in error AND no other tab is retrying → start new fetch
 *    - If another tab is retrying (pending) → do nothing, just wait
 *
 * 5. If retry succeeds → write new value → all tabs' promises resolve
 *    If retry fails → write new error state → schedule another retry (repeat)
 *
 * This ensures:
 * - Retry is automatic, doesn't require get() to be called
 * - Only ONE tab retries at a time (via pending flag)
 * - Retries are rate-limited (30 second intervals with jitter)
 * - All tabs coordinate via localStorage state
 */
export class LocalStorageStore<T> {
  private _options: LSSOptions<T>;
  private _channel: LocalStorageChannel;
  private _usedKeys: string[];
  private _pendingRetries: Map<string, number> = new Map();

  constructor(options: LSSOptions<T>, channel?: LocalStorageChannel) {
    this._options = options;
    this._channel = channel || new LocalStorageChannel('lss:');
    this._usedKeys = [];
  }

  //

  private read = <T>(key: Key): Deserialized<T> | null => {
    if (!this._usedKeys.includes(key)) this._usedKeys.push(key);
    const value = this._channel.read<Deserialized<T>>(key);
    if (!value) return null;
    return deserialize<T>(value);
  };

  //

  private write = <T>(key: Key, value: Deserialized<T>): void => {
    debug(key, `write`, value);
    this._channel.write(key, value);
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

  private makePromise = (key: Key): Promise<void> => {
    debug(key, `makePromise`);
    const promise = new Promise<void>((resolve) => {
      const unlisten = this._channel.listen(key, () => {
        debug(key, `wait promise resolved`);
        unlisten();
        resolve();
      });
    });
    return promise;
  };

  //

  private update = (key: Key, r: { value: T; expire: Date } | null): void => {
    debug(key, `update`);
    if (r) {
      const { value, expire } = r;
      this.write(key, { value, expire, pending: false, wait: undefined });
    } else {
      this.write(key, { error: true, wait: new Date().getTime() + ERROR_WAIT });
    }
  };

  //

  private start = (key: Key): void => {
    debug(key, `start`);
    this._options
      .get(key)
      .then((r) => this.update(key, r))
      .catch((err) => {
        debug(key, `start error`, err);

        // STEP 1 of ERROR RECOVERY: Write error state with retry timestamp
        //
        // Example: If fetch fails at 10:00:00, we write:
        //   { error: true, wait: 10:00:30 }
        //
        // This tells ALL tabs:
        // - "There was an error"
        // - "Don't retry before 10:00:30" (prevents retry storms)
        //
        // All tabs coordinate using this shared timestamp
        this.write(key, {
          error: true,
          wait: new Date().getTime() + ERROR_WAIT, // now + 30 seconds
        });

        // STEP 2: Schedule automatic retry (internal, not triggered by get())
        this.scheduleRetry(key);
      });
  };

  //

  private refresh = (key: Key, value: T): void => {
    debug(key, `refresh`);
    this._options
      .refresh(key, value)
      .then((r) => this.update(key, r))
      .catch((err) => {
        debug(key, `refresh error`, err);

        // STEP 1 of ERROR RECOVERY (same as start())
        // Write error state with retry timestamp to coordinate all tabs
        this.write(key, {
          error: true,
          wait: new Date().getTime() + ERROR_WAIT,
        });

        // STEP 2: Schedule automatic retry
        this.scheduleRetry(key);
      });
  };

  //

  private setPending = (key: Key, o: WithValue<T> | NoValue | null): void => {
    debug(key, `setPending`);
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
    this.write(key, o);
  };

  //

  /**
   * Schedule a retry for a key in error state.
   *
   * Can be called in two scenarios:
   * 1. Fresh error: scheduleRetry(key) → waits ERROR_WAIT (30s)
   * 2. Late-join: scheduleRetry(key, errorWaitTimestamp) → waits remaining time
   *
   * If a retry is already scheduled for this key, does nothing (deduplication).
   *
   * @param key - The cache key
   * @param errorWaitTimestamp - Optional timestamp from error state for calculating remaining time
   */
  private scheduleRetry = (key: Key, errorWaitTimestamp?: number): void => {
    // Already scheduled? Skip
    if (this._pendingRetries.has(key)) {
      return;
    }

    // Calculate base wait time
    let baseWaitTime: number;
    if (errorWaitTimestamp !== undefined) {
      // Late-join: calculate remaining time until scheduled retry
      baseWaitTime = Math.max(0, errorWaitTimestamp - new Date().getTime());
    } else {
      // Fresh error: use full ERROR_WAIT
      baseWaitTime = ERROR_WAIT;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * RETRY_JITTER;
    const waitTime = baseWaitTime + jitter;

    const timeout = setTimeout(() => {
      this._pendingRetries.delete(key);
      this.restartAfterError(key);
    }, waitTime) as unknown as number;

    this._pendingRetries.set(key, timeout);
    debug(
      key,
      `scheduleRetry in ${Math.round(waitTime / 1000)}s ${
        errorWaitTimestamp ? '(late-join)' : '(fresh)'
      }`
    );
  };

  //

  /**
   * STEP 3 of ERROR RECOVERY: Attempt to restart after the wait period.
   *
   * This is called 30 seconds after an error occurred (ERROR_WAIT period).
   *
   * Why do we re-read localStorage before retrying?
   * Because in those 30 seconds, the situation might have changed:
   *
   * Scenario A: Another tab successfully fetched the value
   *   → localStorage now has valid data
   *   → status.error will be false
   *   → We do nothing (success!)
   *
   * Scenario B: Another tab is currently retrying
   *   → localStorage has error state with pending=true
   *   → status.error=true but status.pending=true
   *   → We do nothing (let them finish)
   *
   * Scenario C: Error still there, nobody retrying
   *   → status.error=true and status.pending=false
   *   → We retry by calling start(key)
   */
  private restartAfterError = (key: Key) => {
    debug(key, `restartAfterError`);

    // Clean up our internal timeout tracking
    const existingTimeout = this._pendingRetries.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this._pendingRetries.delete(key);
    }

    // ALWAYS re-read current state - 30 seconds have passed!
    const o = this.read<T>(key);
    const status = this.status(o);

    // Debug: Log the decision
    debug(key, `restartAfterError decision`, {
      hasObject: !!o,
      object: o,
      status,
      willRetry: status.error && !status.pending,
    });

    // Handle error states
    if (status.error) {
      if (status.pending) {
        // Stuck pending state (timeout expired while pending)
        // Clear it and allow retry
        debug(
          key,
          `restartAfterError: clearing stuck pending state and retrying`
        );
        // Write a clean error state without pending
        this.write(key, {
          error: true,
          wait: new Date().getTime() + ERROR_WAIT,
        });
        // Now start the retry
        this.start(key);
      } else {
        // Normal error, not pending - retry
        debug(key, `restartAfterError calling start`);
        this.start(key);
      }
    } else {
      // Error resolved (another tab fixed it)
      debug(key, `restartAfterError skipping: error resolved`);
    }
  };

  //

  public get = (key: Key): Get<T> => {
    const o = this.read<T>(key);
    const status = this.status(o);
    debug(key, `get`, { object: o, status });

    let promise: Promise<void> | null = null;

    // ERROR STATE: Return promise that resolves when error is fixed
    //
    // Retry is automatically scheduled when the error occurs (in start/refresh catch handlers).
    // If this tab joined late and doesn't have a retry scheduled, schedule one based on remaining time.
    if (status.error) {
      promise = this.makePromise(key);

      // Ensure retry is scheduled (for late-joining tabs or resilience)
      this.scheduleRetry(key, (o as AnError).wait);
    }
    //
    else if (status.missing) {
      if (!status.pending) {
        this.setPending(key, o as NoValue | null);
        promise = this.makePromise(key);
        this.start(key);
      }
    }
    // //  !status.missing
    else {
      if ((status.expiredSoon || status.expired) && !status.pending) {
        this.setPending(key, o as WithValue<T>);
        promise = this.makePromise(key);
        this.refresh(key, (o as WithValue<T>).value);
      }
    }

    if (status.valid)
      return { value: (o as WithValue<T>).value, promise: undefined };
    else {
      if (promise === null)
        // example: missing and pending
        promise = this.makePromise(key);
      return { value: null, promise };
    }
  };

  //

  public reset = (): void => {
    // Clear all pending retries
    this._pendingRetries.forEach((timeout) => clearTimeout(timeout));
    this._pendingRetries.clear();
    // Remove all tracked keys from localStorage
    this._usedKeys.forEach((key) => {
      const fullKey = this._channel.key(key);
      localStorage.removeItem(fullKey);
    });
  };
}
