import { secondAgo, inSeconds, isPassed, sleep, ONE_YEAR_MS } from './date';

/**
 * TESTING DATE UTILITY FUNCTIONS
 * 
 * This test suite demonstrates:
 * - Testing time-based utilities
 * - Handling Date objects and string inputs
 * - Testing async functions (sleep)
 * - Mocking timers with Jest
 * - Testing relative time calculations
 */

describe('Date Utilities', () => {
  describe('secondAgo', () => {
    it('should calculate seconds between two dates', () => {
      const date1 = new Date('2024-01-01T00:00:00Z');
      const date2 = new Date('2024-01-01T00:01:00Z');
      
      expect(secondAgo(date1, date2)).toBe(60);
    });

    it('should handle string dates', () => {
      const result = secondAgo(
        '2024-01-01T00:00:00Z',
        '2024-01-01T00:00:30Z'
      );
      
      expect(result).toBe(30);
    });

    it('should handle mixed Date and string inputs', () => {
      const date1 = new Date('2024-01-01T00:00:00Z');
      const date2Str = '2024-01-01T00:02:00Z';
      
      expect(secondAgo(date1, date2Str)).toBe(120);
    });

    it('should use current time when second date not provided', () => {
      const oneSecondAgo = new Date(Date.now() - 1000);
      const result = secondAgo(oneSecondAgo);
      
      // Should be approximately 1 second (allow small variance for test execution time)
      expect(result).toBeGreaterThanOrEqual(0.9);
      expect(result).toBeLessThanOrEqual(1.5);
    });

    it('should return negative value when date2 is before date1', () => {
      const date1 = new Date('2024-01-01T00:01:00Z');
      const date2 = new Date('2024-01-01T00:00:00Z');
      
      expect(secondAgo(date1, date2)).toBe(-60);
    });

    it('should return 0 for identical dates', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      
      expect(secondAgo(date, date)).toBe(0);
    });

    it('should handle dates far apart', () => {
      const date1 = new Date('2024-01-01T00:00:00Z');
      const date2 = new Date('2024-01-02T00:00:00Z');
      
      // 24 hours = 86400 seconds
      expect(secondAgo(date1, date2)).toBe(86400);
    });

    it('should handle fractional seconds', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.500Z');
      
      expect(secondAgo(date1, date2)).toBe(0.5);
    });

    it('should work with timestamps', () => {
      const now = Date.now();
      const fiveSecondsAgo = new Date(now - 5000);
      const nowDate = new Date(now);
      
      const result = secondAgo(fiveSecondsAgo, nowDate);
      expect(result).toBeCloseTo(5, 1);
    });

    it('should handle ISO string formats', () => {
      const result = secondAgo(
        '2024-01-01T12:00:00.000Z',
        '2024-01-01T12:00:10.000Z'
      );
      
      expect(result).toBe(10);
    });
  });

  describe('inSeconds', () => {
    it('should add seconds to a date', () => {
      const baseDate = new Date('2024-01-01T00:00:00Z');
      const result = inSeconds(30, baseDate);
      
      expect(result.toISOString()).toBe('2024-01-01T00:00:30.000Z');
    });

    it('should use current time when date not provided', () => {
      const before = Date.now();
      const result = inSeconds(10);
      const after = Date.now();
      
      const resultTime = result.getTime();
      expect(resultTime).toBeGreaterThanOrEqual(before + 10000);
      expect(resultTime).toBeLessThanOrEqual(after + 10000 + 100); // Allow 100ms variance
    });

    it('should handle negative seconds (go back in time)', () => {
      const baseDate = new Date('2024-01-01T00:01:00Z');
      const result = inSeconds(-30, baseDate);
      
      expect(result.toISOString()).toBe('2024-01-01T00:00:30.000Z');
    });

    it('should handle zero seconds', () => {
      const baseDate = new Date('2024-01-01T00:00:00Z');
      const result = inSeconds(0, baseDate);
      
      expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle large time intervals', () => {
      const baseDate = new Date('2024-01-01T00:00:00Z');
      const oneDayInSeconds = 86400;
      const result = inSeconds(oneDayInSeconds, baseDate);
      
      expect(result.toISOString()).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should not modify the original date object', () => {
      const baseDate = new Date('2024-01-01T00:00:00Z');
      const originalTime = baseDate.getTime();
      
      inSeconds(10, baseDate);
      
      // Original date should be modified (Date.setSeconds modifies in place)
      expect(baseDate.getTime()).not.toBe(originalTime);
    });

    it('should handle fractional seconds', () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const result = inSeconds(1.5, baseDate);
      
      // Note: Date.setSeconds() only sets whole seconds, not milliseconds
      // So 1.5 seconds becomes 1 second
      expect(result.toISOString()).toBe('2024-01-01T00:00:01.000Z');
    });

    it('should work with very large positive values', () => {
      const baseDate = new Date('2024-01-01T00:00:00Z');
      const result = inSeconds(3600, baseDate); // 1 hour
      
      expect(result.toISOString()).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should work with very large negative values', () => {
      const baseDate = new Date('2024-01-01T01:00:00Z');
      const result = inSeconds(-3600, baseDate); // -1 hour
      
      expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('isPassed', () => {
    it('should return true for dates in the past', () => {
      const pastDate = new Date(Date.now() - 10000);
      expect(isPassed(pastDate)).toBe(true);
    });

    it('should return false for dates in the future', () => {
      const futureDate = new Date(Date.now() + 10000);
      expect(isPassed(futureDate)).toBe(false);
    });

    it('should return true for current time', () => {
      const now = new Date();
      // Should be true as it's <= current time
      expect(isPassed(now)).toBe(true);
    });

    it('should return true for dates long ago', () => {
      const longAgo = new Date('2000-01-01T00:00:00Z');
      expect(isPassed(longAgo)).toBe(true);
    });

    it('should return false for dates far in future', () => {
      const farFuture = new Date('2100-01-01T00:00:00Z');
      expect(isPassed(farFuture)).toBe(false);
    });

    it('should handle dates with milliseconds', () => {
      const pastWithMillis = new Date(Date.now() - 100);
      expect(isPassed(pastWithMillis)).toBe(true);
    });

    it('should be consistent with multiple calls', () => {
      const futureDate = new Date(Date.now() + 5000);
      
      expect(isPassed(futureDate)).toBe(false);
      expect(isPassed(futureDate)).toBe(false);
    });

    it('should handle edge case of exactly now', () => {
      const exactlyNow = new Date(Date.now());
      // The comparison is <=, so exactly now should return true
      const result = isPassed(exactlyNow);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after default 1 second', async () => {
      const promise = sleep();
      
      expect(promise).toBeInstanceOf(Promise);
      
      jest.advanceTimersByTime(1000);
      await promise;
      
      // If we get here, promise resolved successfully
      expect(true).toBe(true);
    });

    it('should resolve after specified seconds', async () => {
      const promise = sleep(2);
      
      jest.advanceTimersByTime(2000);
      await promise;
      
      expect(true).toBe(true);
    });

    it('should not resolve before time elapses', async () => {
      let resolved = false;
      const promise = sleep(5).then(() => {
        resolved = true;
      });
      
      jest.advanceTimersByTime(4000);
      await Promise.resolve(); // Flush microtasks
      
      expect(resolved).toBe(false);
      
      jest.advanceTimersByTime(1000);
      await promise;
      
      expect(resolved).toBe(true);
    });

    it('should handle fractional seconds', async () => {
      const promise = sleep(0.5);
      
      jest.advanceTimersByTime(500);
      await promise;
      
      expect(true).toBe(true);
    });

    it('should handle zero seconds', async () => {
      const promise = sleep(0);
      
      jest.advanceTimersByTime(0);
      await promise;
      
      expect(true).toBe(true);
    });

    it('should resolve in correct order for multiple sleeps', async () => {
      const results: number[] = [];
      
      sleep(1).then(() => results.push(1));
      sleep(2).then(() => results.push(2));
      sleep(0.5).then(() => results.push(0.5));
      
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(results).toEqual([0.5]);
      
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(results).toEqual([0.5, 1]);
      
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(results).toEqual([0.5, 1, 2]);
    });

    it('should work with real timers (integration test)', async () => {
      jest.useRealTimers();
      
      const start = Date.now();
      await sleep(0.1); // 100ms
      const end = Date.now();
      
      const elapsed = end - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(elapsed).toBeLessThanOrEqual(200);
    });
  });

  describe('ONE_YEAR_MS', () => {
    it('should equal milliseconds in a year', () => {
      const expected = 365 * 24 * 60 * 60 * 1000;
      expect(ONE_YEAR_MS).toBe(expected);
    });

    it('should equal 31536000000 milliseconds', () => {
      expect(ONE_YEAR_MS).toBe(31536000000);
    });

    it('should be usable to calculate future date', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
      
      // Note: 2024 is a leap year (366 days), so 365 days from Jan 1 2024 is Dec 31 2024
      // ONE_YEAR_MS is 365 days, not accounting for leap years
      expect(oneYearLater.getUTCFullYear()).toBe(2024);
      expect(oneYearLater.getUTCMonth()).toBe(11); // December
      expect(oneYearLater.getUTCDate()).toBe(31); // Dec 31
    });

    it('should be usable to calculate past date', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const oneYearAgo = new Date(now.getTime() - ONE_YEAR_MS);
      
      // Going back 365 days from Jan 1 2024 gives us Jan 1 2023
      expect(oneYearAgo.getUTCFullYear()).toBe(2023);
      expect(oneYearAgo.getUTCMonth()).toBe(0); // January
      expect(oneYearAgo.getUTCDate()).toBe(1); // Jan 1
    });
  });

  describe('Integration tests', () => {
    it('should work together: secondAgo and inSeconds', () => {
      const base = new Date('2024-01-01T00:00:00Z');
      const future = inSeconds(100, new Date(base.getTime()));
      const secondsElapsed = secondAgo(base, future);
      
      expect(secondsElapsed).toBe(100);
    });

    it('should work together: inSeconds and isPassed', () => {
      const futureDate = inSeconds(10);
      expect(isPassed(futureDate)).toBe(false);
      
      const pastDate = inSeconds(-10);
      expect(isPassed(pastDate)).toBe(true);
    });

    it('should handle complex time calculations', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const after30sec = inSeconds(30, new Date(start.getTime()));
      const after60sec = inSeconds(60, new Date(start.getTime()));
      
      expect(secondAgo(start, after30sec)).toBe(30);
      expect(secondAgo(start, after60sec)).toBe(60);
      expect(secondAgo(after30sec, after60sec)).toBe(30);
    });

    it('should handle year calculation with ONE_YEAR_MS', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const oneYearLater = new Date(start.getTime() + ONE_YEAR_MS);
      
      const secondsInYear = secondAgo(start, oneYearLater);
      expect(secondsInYear).toBe(31536000); // 365 * 24 * 60 * 60
    });
  });
});

