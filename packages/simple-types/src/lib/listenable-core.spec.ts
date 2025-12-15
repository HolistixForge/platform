import { Listenable } from './listenable-core';

/**
 * TESTING LISTENABLE PATTERN
 * 
 * This test suite demonstrates:
 * - Testing observer/listener pattern implementation
 * - Testing event-driven architecture
 * - Testing listener management (add, remove, notify)
 * - Testing with multiple listeners
 * - Testing inheritance and protected methods
 */

describe('Listenable', () => {
  describe('Basic functionality', () => {
    let listenable: Listenable;

    beforeEach(() => {
      listenable = new Listenable();
    });

    it('should create a Listenable instance', () => {
      expect(listenable).toBeInstanceOf(Listenable);
    });

    it('should have addListener method', () => {
      expect(typeof listenable.addListener).toBe('function');
    });

    it('should have removeListener method', () => {
      expect(typeof listenable.removeListener).toBe('function');
    });

    it('should add a listener', () => {
      const listener = jest.fn();
      
      expect(() => {
        listenable.addListener(listener);
      }).not.toThrow();
    });

    it('should remove a listener', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      
      expect(() => {
        listenable.removeListener(listener);
      }).not.toThrow();
    });
  });

  describe('Listener notification', () => {
    // Create a test subclass to expose notifyListeners
    class TestListenable extends Listenable {
      public notify() {
        this.notifyListeners();
      }
    }

    let listenable: TestListenable;

    beforeEach(() => {
      listenable = new TestListenable();
    });

    it('should notify a single listener', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      listenable.notify();
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should notify listeners in order they were added', () => {
      const callOrder: number[] = [];
      
      const listener1 = jest.fn(() => callOrder.push(1));
      const listener2 = jest.fn(() => callOrder.push(2));
      const listener3 = jest.fn(() => callOrder.push(3));
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.notify();
      
      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('should notify same listener multiple times if added multiple times', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      listenable.addListener(listener);
      
      listenable.notify();
      
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should not notify removed listener', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      listenable.removeListener(listener);
      listenable.notify();
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove all instances if listener added multiple times', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      listenable.addListener(listener);
      listenable.addListener(listener);
      
      listenable.removeListener(listener);
      listenable.notify();
      
      // removeListener uses filter which removes ALL instances
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle removing listener that was never added', () => {
      const listener = jest.fn();
      
      expect(() => {
        listenable.removeListener(listener);
      }).not.toThrow();
    });

    it('should handle notifying with no listeners', () => {
      expect(() => {
        listenable.notify();
      }).not.toThrow();
    });

    it('should handle multiple notifications', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      
      listenable.notify();
      listenable.notify();
      listenable.notify();
      
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should handle listeners added after first notification', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
      
      listenable.addListener(listener2);
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Listener management', () => {
    class TestListenable extends Listenable {
      public notify() {
        this.notifyListeners();
      }
    }

    let listenable: TestListenable;

    beforeEach(() => {
      listenable = new TestListenable();
    });

    it('should handle removing listener in the middle of list', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.removeListener(listener2);
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should handle removing first listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.removeListener(listener1);
      listenable.notify();
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should handle removing last listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.removeListener(listener3);
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).not.toHaveBeenCalled();
    });

    it('should handle removing all listeners one by one', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      
      listenable.addListener(listener1);
      listenable.addListener(listener2);
      listenable.addListener(listener3);
      
      listenable.removeListener(listener1);
      listenable.removeListener(listener2);
      listenable.removeListener(listener3);
      
      listenable.notify();
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    class TestListenable extends Listenable {
      public notify() {
        this.notifyListeners();
      }
    }

    let listenable: TestListenable;

    beforeEach(() => {
      listenable = new TestListenable();
    });

    it('should handle listener that throws error', () => {
      const goodListener = jest.fn();
      const badListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const anotherGoodListener = jest.fn();
      
      listenable.addListener(goodListener);
      listenable.addListener(badListener);
      listenable.addListener(anotherGoodListener);
      
      expect(() => {
        listenable.notify();
      }).toThrow('Listener error');
      
      // First listener should have been called
      expect(goodListener).toHaveBeenCalledTimes(1);
      // Bad listener was called and threw
      expect(badListener).toHaveBeenCalledTimes(1);
      // Third listener might not be called due to error
    });

    it('should handle listener removing itself during notification', () => {
      const callCount = { count: 0 };
      
      const selfRemovingListener = () => {
        callCount.count++;
        listenable.removeListener(selfRemovingListener);
      };
      
      listenable.addListener(selfRemovingListener);
      
      listenable.notify();
      expect(callCount.count).toBe(1);
      
      listenable.notify();
      expect(callCount.count).toBe(1); // Not called again
    });

    it('should handle listener adding another listener during notification', () => {
      const listener2 = jest.fn();
      const listener1 = jest.fn(() => {
        listenable.addListener(listener2);
      });
      
      listenable.addListener(listener1);
      listenable.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      // listener2 was added during notification, so not called in first notify
      expect(listener2).not.toHaveBeenCalled();
      
      listenable.notify();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should accept optional arguments in addListener', () => {
      const listener = jest.fn();
      
      expect(() => {
        listenable.addListener(listener, 'arg1', 'arg2', { foo: 'bar' });
      }).not.toThrow();
    });

    it('should accept optional arguments in removeListener', () => {
      const listener = jest.fn();
      
      listenable.addListener(listener);
      
      expect(() => {
        listenable.removeListener(listener, 'arg1', 'arg2');
      }).not.toThrow();
    });
  });

  describe('Multiple instances', () => {
    class TestListenable extends Listenable {
      public notify() {
        this.notifyListeners();
      }
    }

    it('should maintain separate listener lists for different instances', () => {
      const listenable1 = new TestListenable();
      const listenable2 = new TestListenable();
      
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      listenable1.addListener(listener1);
      listenable2.addListener(listener2);
      
      listenable1.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
      
      listenable2.notify();
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should allow same listener on multiple instances', () => {
      const listenable1 = new TestListenable();
      const listenable2 = new TestListenable();
      
      const sharedListener = jest.fn();
      
      listenable1.addListener(sharedListener);
      listenable2.addListener(sharedListener);
      
      listenable1.notify();
      expect(sharedListener).toHaveBeenCalledTimes(1);
      
      listenable2.notify();
      expect(sharedListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Inheritance and protected methods', () => {
    it('should allow subclasses to use notifyListeners', () => {
      class CustomListenable extends Listenable {
        public triggerEvent() {
          this.notifyListeners();
        }
      }
      
      const custom = new CustomListenable();
      const listener = jest.fn();
      
      custom.addListener(listener);
      custom.triggerEvent();
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow subclasses to extend functionality', () => {
      class CountingListenable extends Listenable {
        private notifyCount = 0;
        
        public notify() {
          this.notifyCount++;
          this.notifyListeners();
        }
        
        public getNotifyCount() {
          return this.notifyCount;
        }
      }
      
      const counting = new CountingListenable();
      const listener = jest.fn();
      
      counting.addListener(listener);
      counting.notify();
      counting.notify();
      counting.notify();
      
      expect(listener).toHaveBeenCalledTimes(3);
      expect(counting.getNotifyCount()).toBe(3);
    });
  });
});

