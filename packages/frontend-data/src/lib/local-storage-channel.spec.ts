import { LocalStorageChannel } from './local-storage-channel';

describe('LocalStorageChannel', () => {
  let channel: LocalStorageChannel;
  let mockLocalStorage: Record<string, string>;
  let storageEventListeners: Array<(event: Event) => void>;
  let customEventListeners: Array<(event: Event) => void>;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};

    // Use a property descriptor to make getItem/setItem closures work properly
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockLocalStorage[key];
        },
        clear: () => {
          mockLocalStorage = {};
        },
        length: 0,
        key: () => null,
      },
      writable: true,
      configurable: true,
    });

    // Mock window event listeners
    storageEventListeners = [];
    customEventListeners = [];

    jest
      .spyOn(window, 'addEventListener')
      .mockImplementation(
        (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === 'storage') {
            storageEventListeners.push(listener as (event: Event) => void);
          } else if (type === 'local-storage-store') {
            customEventListeners.push(listener as (event: Event) => void);
          }
        }
      );

    jest
      .spyOn(window, 'removeEventListener')
      .mockImplementation(
        (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === 'storage') {
            const index = storageEventListeners.indexOf(
              listener as (event: Event) => void
            );
            if (index > -1) storageEventListeners.splice(index, 1);
          } else if (type === 'local-storage-store') {
            const index = customEventListeners.indexOf(
              listener as (event: Event) => void
            );
            if (index > -1) customEventListeners.splice(index, 1);
          }
        }
      );

    jest.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      if (event.type === 'local-storage-store') {
        customEventListeners.forEach((listener) => listener(event));
      }
      return true;
    });

    channel = new LocalStorageChannel('test:');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create channel with custom prefix', () => {
      const customChannel = new LocalStorageChannel('custom:');
      expect(customChannel.key('mykey')).toBe('custom:mykey');
    });

    it('should create channel with default prefix', () => {
      const defaultChannel = new LocalStorageChannel();
      expect(defaultChannel.key('mykey')).toBe('lss:mykey');
    });
  });

  describe('key()', () => {
    it('should prepend prefix to raw key', () => {
      expect(channel.key('user-123')).toBe('test:user-123');
    });

    it('should handle empty key', () => {
      expect(channel.key('')).toBe('test:');
    });

    it('should handle special characters in key', () => {
      expect(channel.key('user:session:123')).toBe('test:user:session:123');
    });
  });

  describe('read()', () => {
    it('should read and parse JSON value from localStorage', () => {
      const testData = { name: 'John', age: 30 };
      const key = 'test:user';
      mockLocalStorage[key] = JSON.stringify(testData);

      // Verify localStorage.getItem is actually getting the value
      const retrieved = localStorage.getItem(key);
      expect(retrieved).toBe(JSON.stringify(testData));

      const result = channel.read('user');
      expect(result).toEqual(testData);
    });

    it('should return null if key does not exist', () => {
      const result = channel.read('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      mockLocalStorage['test:invalid'] = 'not valid json {';

      const result = channel.read('invalid');
      expect(result).toBeNull();
    });

    it('should handle primitive values', () => {
      mockLocalStorage['test:string'] = JSON.stringify('hello');
      mockLocalStorage['test:number'] = JSON.stringify(42);
      mockLocalStorage['test:boolean'] = JSON.stringify(true);

      expect(channel.read('string')).toBe('hello');
      expect(channel.read('number')).toBe(42);
      expect(channel.read('boolean')).toBe(true);
    });

    it('should handle null value', () => {
      mockLocalStorage['test:null'] = JSON.stringify(null);
      expect(channel.read('null')).toBeNull();
    });

    it('should handle nested objects', () => {
      const complexData = {
        user: { name: 'Jane', address: { city: 'NYC' } },
        items: [1, 2, 3],
      };
      mockLocalStorage['test:complex'] = JSON.stringify(complexData);

      const result = channel.read('complex');
      expect(result).toEqual(complexData);
    });
  });

  describe('write()', () => {
    it('should write value to localStorage as JSON', () => {
      const testData = { name: 'Alice', score: 100 };
      channel.write('player', testData);

      // Verify data was written to mock localStorage
      expect(mockLocalStorage['test:player']).toBe(JSON.stringify(testData));

      // Verify we can read it back
      expect(localStorage.getItem('test:player')).toBe(
        JSON.stringify(testData)
      );
    });

    it('should dispatch custom local-storage-store event', () => {
      const testData = { value: 42 };
      channel.write('data', testData);

      expect(window.dispatchEvent).toHaveBeenCalled();
      const dispatchedEvent = (window.dispatchEvent as jest.Mock).mock
        .calls[0][0];
      expect(dispatchedEvent.type).toBe('local-storage-store');
      expect(dispatchedEvent.key).toBe('test:data');
    });

    it('should trigger listeners in same tab (custom event)', () => {
      const callback = jest.fn();
      channel.listen('data', callback);

      const testData = { value: 42 };
      channel.write('data', testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should handle primitive values', () => {
      channel.write('string', 'test');
      expect(mockLocalStorage['test:string']).toBe(JSON.stringify('test'));
      expect(localStorage.getItem('test:string')).toBe(JSON.stringify('test'));

      channel.write('number', 123);
      expect(mockLocalStorage['test:number']).toBe(JSON.stringify(123));
      expect(localStorage.getItem('test:number')).toBe(JSON.stringify(123));

      channel.write('boolean', false);
      expect(mockLocalStorage['test:boolean']).toBe(JSON.stringify(false));
      expect(localStorage.getItem('test:boolean')).toBe(JSON.stringify(false));
    });

    it('should handle null and undefined', () => {
      channel.write('null', null);
      expect(mockLocalStorage['test:null']).toBe(JSON.stringify(null));
      expect(localStorage.getItem('test:null')).toBe(JSON.stringify(null));

      channel.write('undefined', undefined);
      // JSON.stringify(undefined) returns the actual value undefined (not a string)
      // When passed to localStorage.setItem, our mock stores it directly as undefined
      expect(mockLocalStorage['test:undefined']).toBe(undefined);
      // When we retrieve it via getItem, our mock returns null for undefined values (|| null)
      expect(localStorage.getItem('test:undefined')).toBe(null);
    });
  });

  describe('listen()', () => {
    it('should register listener for storage events', () => {
      const callback = jest.fn();
      channel.listen('mykey', callback);

      expect(window.addEventListener).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'local-storage-store',
        expect.any(Function)
      );
    });

    it('should call callback when matching storage event occurs (other tab)', () => {
      const callback = jest.fn();
      channel.listen('user', callback);

      // Simulate storage event from another tab
      // First write the data to storage, then trigger the event
      const testData = { name: 'Bob' };
      mockLocalStorage['test:user'] = JSON.stringify(testData);

      const storageEvent = new StorageEvent('storage', {
        key: 'test:user',
        newValue: JSON.stringify(testData),
      });

      storageEventListeners.forEach((listener) => listener(storageEvent));

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should call callback when matching custom event occurs (same tab)', () => {
      const callback = jest.fn();
      channel.listen('user', callback);

      // Simulate write in same tab
      const testData = { name: 'Charlie' };
      channel.write('user', testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should not call callback for different key', () => {
      const callback = jest.fn();
      channel.listen('key1', callback);

      const testData = { value: 123 };
      mockLocalStorage['test:key2'] = JSON.stringify(testData);

      const storageEvent = new StorageEvent('storage', {
        key: 'test:key2',
      });

      storageEventListeners.forEach((listener) => listener(storageEvent));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners on same key', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      channel.listen('shared', callback1);
      channel.listen('shared', callback2);

      const testData = { value: 999 };
      channel.write('shared', testData);

      expect(callback1).toHaveBeenCalledWith(testData);
      expect(callback2).toHaveBeenCalledWith(testData);
    });

    it('should return unlisten function', () => {
      const callback = jest.fn();
      const unlisten = channel.listen('temp', callback);

      expect(typeof unlisten).toBe('function');

      unlisten();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'local-storage-store',
        expect.any(Function)
      );
    });

    it('should not call callback after unlisten', () => {
      const callback = jest.fn();
      const unlisten = channel.listen('temp', callback);

      unlisten();

      const testData = { value: 456 };
      channel.write('temp', testData);

      // Callback should not be called because we unlistened
      // We need to check that it wasn't called by the listener we removed
      // Since we're directly calling write which dispatches events,
      // the listener we removed should not be triggered
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle null value in storage event', () => {
      const callback = jest.fn();
      channel.listen('deleted', callback);

      // Simulate key deletion
      const storageEvent = new StorageEvent('storage', {
        key: 'test:deleted',
      });

      storageEventListeners.forEach((listener) => listener(storageEvent));

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('Cross-tab coordination', () => {
    it('should coordinate between tabs using dual event system', () => {
      const sameTabCallback = jest.fn();
      const otherTabCallback = jest.fn();

      // Listener in "same tab"
      channel.listen('sync', sameTabCallback);

      // Simulate listener in "other tab"
      channel.listen('sync', otherTabCallback);

      // Write in same tab - should trigger custom event
      const testData = { synced: true };
      channel.write('sync', testData);

      // Both callbacks should be called (via custom event in same tab)
      expect(sameTabCallback).toHaveBeenCalledWith(testData);
      expect(otherTabCallback).toHaveBeenCalledWith(testData);

      // Clear calls
      sameTabCallback.mockClear();
      otherTabCallback.mockClear();

      // Simulate storage event from other tab
      const newData = { synced: false };
      mockLocalStorage['test:sync'] = JSON.stringify(newData);
      const storageEvent = new StorageEvent('storage', {
        key: 'test:sync',
        newValue: JSON.stringify(newData),
      });

      storageEventListeners.forEach((listener) => listener(storageEvent));

      // Both callbacks should be called (via storage event from other tab)
      expect(sameTabCallback).toHaveBeenCalledWith(newData);
      expect(otherTabCallback).toHaveBeenCalledWith(newData);
    });
  });
});
