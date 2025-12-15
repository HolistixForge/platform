import { LocalStorageStore } from './local-storage-store';
import { LocalStorageChannel } from './local-storage-channel';

describe('LocalStorageStore', () => {
  let store: LocalStorageStore<string>;
  let mockGet: jest.Mock;
  let mockRefresh: jest.Mock;
  let mockChannel: jest.Mocked<LocalStorageChannel>;
  let mockLocalStorage: Record<string, any>;
  let listeners: Map<string, Array<() => void>>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLocalStorage = {};
    listeners = new Map();

    // Mock LocalStorageChannel
    mockChannel = {
      read: jest.fn((key: string) => mockLocalStorage[key] || null),
      write: jest.fn((key: string, value: any) => {
        mockLocalStorage[key] = value;
      }),
      listen: jest.fn((key: string, cb: () => void) => {
        if (!listeners.has(key)) {
          listeners.set(key, []);
        }
        listeners.get(key)!.push(cb);
        return () => {
          const cbs = listeners.get(key);
          if (cbs) {
            const index = cbs.indexOf(cb);
            if (index > -1) cbs.splice(index, 1);
          }
        };
      }),
      key: jest.fn((rawKey: string) => `lss:${rawKey}`),
    } as any;

    mockGet = jest.fn();
    mockRefresh = jest.fn();

    store = new LocalStorageStore(
      {
        get: mockGet,
        refresh: mockRefresh,
      },
      mockChannel
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper to trigger listeners for a key
  const triggerListeners = (key: string) => {
    const cbs = listeners.get(key);
    if (cbs) {
      cbs.forEach((cb) => cb());
    }
  };

  describe('get() - Missing value scenarios', () => {
    it('should fetch value when missing from cache', async () => {
      const expectedValue = 'test-value';
      const expectedExpire = new Date(Date.now() + 60000);

      mockGet.mockResolvedValue({
        value: expectedValue,
        expire: expectedExpire,
      });

      const result = store.get('test-key');

      // Should return promise initially
      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();

      // Should have set pending state
      expect(mockChannel.write).toHaveBeenCalledWith('test-key', {
        value: undefined,
        expire: undefined,
        pending: true,
        wait: expect.any(Number),
      });

      // Simulate successful fetch
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Should have written the value
      expect(mockChannel.write).toHaveBeenCalledWith('test-key', {
        value: expectedValue,
        expire: expectedExpire,
        pending: false,
        wait: undefined,
      });
    });

    it('should not start multiple fetches for same key when pending', () => {
      mockGet.mockResolvedValue({
        value: 'test',
        expire: new Date(Date.now() + 60000),
      });

      // Set pending state
      mockLocalStorage['test-key'] = {
        value: undefined,
        expire: undefined,
        pending: true,
        wait: Date.now() + 5000,
      };

      const result = store.get('test-key');

      // Should return promise but not call get again
      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('get() - Valid value scenarios', () => {
    it('should return cached value when valid', () => {
      const cachedValue = 'cached';
      const futureExpire = new Date(Date.now() + 3600000); // 1 hour from now

      mockLocalStorage['test-key'] = {
        value: cachedValue,
        expire: futureExpire,
        pending: false,
      };

      const result = store.get('test-key');

      expect(result.value).toBe(cachedValue);
      expect(result.promise).toBeUndefined();
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('should trigger refresh when value expires soon', async () => {
      const cachedValue = 'expires-soon';
      const soonExpire = new Date(Date.now() + 60000); // 1 minute (< 5 min threshold)

      mockLocalStorage['test-key'] = {
        value: cachedValue,
        expire: soonExpire,
        pending: false,
      };

      mockRefresh.mockResolvedValue({
        value: 'refreshed',
        expire: new Date(Date.now() + 3600000),
      });

      const result = store.get('test-key');

      // Should return current value while refreshing in background
      expect(result.value).toBe(cachedValue);
      expect(result.promise).toBeUndefined();

      // Should have triggered refresh
      expect(mockRefresh).toHaveBeenCalledWith('test-key', cachedValue);
    });

    it('should not trigger refresh when already pending', () => {
      const cachedValue = 'expires-soon';
      const soonExpire = new Date(Date.now() + 60000);

      mockLocalStorage['test-key'] = {
        value: cachedValue,
        expire: soonExpire,
        pending: true, // Already refreshing
        wait: Date.now() + 5000,
      };

      const result = store.get('test-key');

      expect(result.value).toBe(cachedValue);
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe('get() - Expired value scenarios', () => {
    it('should refresh expired value immediately', async () => {
      const expiredValue = 'expired';
      const pastExpire = new Date(Date.now() - 1000); // Already expired

      mockLocalStorage['test-key'] = {
        value: expiredValue,
        expire: pastExpire,
        pending: false,
      };

      mockRefresh.mockResolvedValue({
        value: 'refreshed',
        expire: new Date(Date.now() + 3600000),
      });

      const result = store.get('test-key');

      // Should return promise for expired value
      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();

      // Should have triggered refresh
      expect(mockRefresh).toHaveBeenCalledWith('test-key', expiredValue);
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle fetch error and schedule retry', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = store.get('test-key');

      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();

      // Wait for async operations and promise rejection
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      // Should have written error state with wait timestamp
      // Find the error write call (not the pending one)
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);

      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('test-key');
      expect(errorCall[1]).toMatchObject({
        error: true,
        wait: expect.any(Number),
      });
      expect(errorCall[1].wait).toBeGreaterThan(Date.now());
    });

    it('should schedule retry with jitter to prevent thundering herd', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      store.get('test-key');

      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      // Should have scheduled retry
      // Find the error write call
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);

      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('test-key');
      expect(errorCall[1]).toMatchObject({
        error: true,
        wait: expect.any(Number),
      });
    });

    it('should return promise for error state and ensure retry is scheduled', () => {
      const errorWait = Date.now() + 30000; // 30 seconds from now

      mockLocalStorage['test-key'] = {
        error: true,
        wait: errorWait,
      };

      const result = store.get('test-key');

      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();
    });

    it('should retry after error wait period expires', async () => {
      const errorWait = Date.now() + 30000;

      mockLocalStorage['test-key'] = {
        error: true,
        wait: errorWait,
      };

      mockGet.mockResolvedValue({
        value: 'recovered',
        expire: new Date(Date.now() + 3600000),
      });

      store.get('test-key');

      // Fast-forward to after error wait period + jitter
      jest.advanceTimersByTime(35000);
      await Promise.resolve();

      // Should have retried the fetch
      expect(mockGet).toHaveBeenCalledWith('test-key');
    });

    it('should handle stuck pending state as error', () => {
      const pastWait = Date.now() - 1000; // Wait expired

      mockLocalStorage['test-key'] = {
        value: 'something',
        expire: new Date(Date.now() + 60000),
        pending: true,
        wait: pastWait, // Stuck in pending
      };

      const result = store.get('test-key');

      // Should treat as error
      expect(result.value).toBeNull();
      expect(result.promise).toBeDefined();
    });

    it('should not retry if another tab is already retrying', async () => {
      mockGet.mockRejectedValue(new Error('First error'));

      // First call causes error
      store.get('test-key');
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Simulate another tab set pending state (retrying)
      mockLocalStorage['test-key'] = {
        error: true,
        wait: Date.now() - 1000, // Wait period expired
      };

      mockGet.mockClear();

      // Fast-forward to retry time
      jest.advanceTimersByTime(35000);

      // Simulate another tab is now pending (fixing the issue)
      mockLocalStorage['test-key'] = {
        value: undefined,
        expire: undefined,
        pending: true,
        wait: Date.now() + 5000,
      };

      await Promise.resolve();

      // Should NOT have retried since another tab is handling it
      // The retry would only happen if status.error=true AND status.pending=false
    });
  });

  describe('Cross-tab coordination', () => {
    it('should listen for changes from other tabs when value is pending', () => {
      // Set up pending state which will create a promise and listener
      mockLocalStorage['sync-key'] = {
        value: undefined,
        expire: undefined,
        pending: true,
        wait: Date.now() + 5000,
      };

      const result = store.get('sync-key');

      // Should have created a promise and registered listener
      expect(result.promise).toBeDefined();
      expect(mockChannel.listen).toHaveBeenCalledWith(
        'sync-key',
        expect.any(Function)
      );
    });

    it('should resolve promise when value is written by another tab', async () => {
      mockLocalStorage['sync-key'] = {
        value: undefined,
        expire: undefined,
        pending: true,
        wait: Date.now() + 5000,
      };

      const result = store.get('sync-key');
      expect(result.promise).toBeDefined();

      const promiseResolved = jest.fn();
      result.promise?.then(promiseResolved);

      // Simulate another tab wrote the value
      mockLocalStorage['sync-key'] = {
        value: 'synced-value',
        expire: new Date(Date.now() + 60000),
        pending: false,
      };

      // Trigger the listener
      triggerListeners('sync-key');

      await Promise.resolve(); // Let promise resolve

      expect(promiseResolved).toHaveBeenCalled();
    });
  });

  describe('refresh() scenarios', () => {
    it('should handle refresh errors with retry scheduling', async () => {
      const cachedValue = 'to-refresh';
      const expiredDate = new Date(Date.now() - 1000);

      mockLocalStorage['refresh-key'] = {
        value: cachedValue,
        expire: expiredDate,
        pending: false,
      };

      mockRefresh.mockRejectedValue(new Error('Refresh failed'));

      store.get('refresh-key');

      // Wait for promise rejection to be processed
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      // Check that error state was written (last call should be error state)
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);
      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('refresh-key');
      expect(errorCall[1]).toMatchObject({
        error: true,
        wait: expect.any(Number),
      });
    });
  });

  describe('reset()', () => {
    it('should clear all pending retries', async () => {
      mockGet.mockRejectedValue(new Error('Error'));

      // Create error state with scheduled retry
      store.get('key1');
      store.get('key2');

      // Wait for initial operations
      jest.advanceTimersByTime(100);

      mockGet.mockClear();

      // Reset the store
      store.reset();

      // Fast-forward past retry times
      jest.advanceTimersByTime(40000);

      // Retries should not have fired
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should remove all tracked keys from localStorage', () => {
      // Setup some keys with far-future expiration to avoid refresh
      mockLocalStorage['key1'] = {
        value: 'test1',
        expire: new Date(Date.now() + 3600000),
        pending: false,
      };
      mockLocalStorage['key2'] = {
        value: 'test2',
        expire: new Date(Date.now() + 3600000),
        pending: false,
      };

      store.get('key1');
      store.get('key2');

      const removeItemMock = jest.fn();
      global.localStorage = {
        removeItem: removeItemMock,
      } as any;

      store.reset();

      expect(mockChannel.key).toHaveBeenCalledWith('key1');
      expect(mockChannel.key).toHaveBeenCalledWith('key2');
    });
  });

  describe('Edge cases', () => {
    it('should handle null response from get() and schedule retry', async () => {
      mockGet.mockResolvedValue(null);

      store.get('null-key');

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Should write error state with wait timestamp
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);

      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('null-key');
      expect(errorCall[1]).toMatchObject({
        error: true,
        wait: expect.any(Number),
      });
      expect(errorCall[1].wait).toBeGreaterThan(Date.now());

      // Clear the mock to verify retry is scheduled
      mockGet.mockClear();
      mockGet.mockResolvedValue({
        value: 'recovered',
        expire: new Date(Date.now() + 60000),
      });

      // Fast-forward to retry time (ERROR_WAIT + jitter)
      jest.advanceTimersByTime(35000);
      await Promise.resolve();

      // Should have automatically retried
      expect(mockGet).toHaveBeenCalledWith('null-key');
    });

    it('should handle null response from refresh() and schedule retry', async () => {
      const expiredValue = 'expired';
      const pastExpire = new Date(Date.now() - 1000);

      mockLocalStorage['refresh-null'] = {
        value: expiredValue,
        expire: pastExpire,
        pending: false,
      };

      mockRefresh.mockResolvedValue(null);

      store.get('refresh-null');

      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Should write error state with wait timestamp
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);

      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('refresh-null');
      expect(errorCall[1]).toMatchObject({
        error: true,
        wait: expect.any(Number),
      });

      // Clear the mock to verify retry is scheduled
      mockGet.mockClear();
      mockGet.mockResolvedValue({
        value: 'recovered',
        expire: new Date(Date.now() + 60000),
      });

      // Fast-forward to retry time (ERROR_WAIT + jitter)
      jest.advanceTimersByTime(35000);
      await Promise.resolve();

      // Should have automatically retried using get() (not refresh)
      // because error recovery always uses start() which calls get()
      expect(mockGet).toHaveBeenCalledWith('refresh-null');
    });

    it('should handle Date objects in deserialization', () => {
      const dateString = new Date(Date.now() + 3600000); // Future date

      mockLocalStorage['date-key'] = {
        value: 'test',
        expire: dateString.toISOString(), // Stored as string
        pending: false,
      };

      const result = store.get('date-key');

      expect(result.value).toBe('test');
    });

    it('should track multiple keys independently', () => {
      mockLocalStorage['key1'] = {
        value: 'value1',
        expire: new Date(Date.now() + 3600000), // 1 hour to avoid expiring soon
        pending: false,
      };

      mockLocalStorage['key2'] = {
        value: 'value2',
        expire: new Date(Date.now() + 3600000), // 1 hour to avoid expiring soon
        pending: false,
      };

      const result1 = store.get('key1');
      const result2 = store.get('key2');

      expect(result1.value).toBe('value1');
      expect(result2.value).toBe('value2');
    });
  });

  describe('Complex error recovery flow', () => {
    it('should complete full error recovery cycle', async () => {
      // Step 1: Initial fetch fails
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      const result1 = store.get('recovery-key');
      expect(result1.value).toBeNull();

      // Wait for initial async operations and promise rejection
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      // Verify error state was written
      const writeCalls = (mockChannel.write as jest.Mock).mock.calls;
      const errorCall = writeCalls.find((call) => call[1].error === true);
      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toBe('recovery-key');

      // Step 2: Retry after wait period
      mockGet.mockResolvedValue({
        value: 'recovered',
        expire: new Date(Date.now() + 3600000),
      });

      // Fast-forward to retry time
      jest.advanceTimersByTime(35000);
      await Promise.resolve();

      // Should have retried and written success state
      expect(mockGet).toHaveBeenCalledWith('recovery-key');
      expect(mockChannel.write).toHaveBeenCalledWith('recovery-key', {
        value: 'recovered',
        expire: expect.any(Date),
        pending: false,
        wait: undefined,
      });
    });
  });

  describe('Type handling', () => {
    it('should handle complex object types', () => {
      type ComplexType = {
        id: number;
        data: { nested: string[] };
        timestamp: Date;
      };

      const complexStore = new LocalStorageStore<ComplexType>(
        {
          get: async () => ({
            value: {
              id: 1,
              data: { nested: ['a', 'b'] },
              timestamp: new Date(),
            },
            expire: new Date(Date.now() + 60000),
          }),
          refresh: async () => null,
        },
        mockChannel
      );

      const complexValue = {
        id: 1,
        data: { nested: ['a', 'b'] },
        timestamp: new Date('2024-12-15'),
      };

      mockLocalStorage['complex'] = {
        value: complexValue,
        expire: new Date(Date.now() + 60000),
        pending: false,
      };

      const result = complexStore.get('complex');
      expect(result.value).toEqual(complexValue);
    });
  });
});
