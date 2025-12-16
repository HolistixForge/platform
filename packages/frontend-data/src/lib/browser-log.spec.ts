/**
 * Tests for browser logging utility
 *
 * Tests browser-side logging helper that provides centralized logging
 * and optional OpenTelemetry span event integration.
 */

import { trace } from '@opentelemetry/api';
import { browserLog, BrowserLogLevel } from './browser-log';

describe('browserLog', () => {
  // Store original console methods
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  // Mock console methods
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  // Mock OpenTelemetry trace
  let mockSpan: any;
  let getActiveSpanSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

    // Mock OpenTelemetry span
    mockSpan = {
      addEvent: jest.fn(),
    };

    getActiveSpanSpy = jest
      .spyOn(trace, 'getActiveSpan')
      .mockReturnValue(mockSpan);
  });

  afterEach(() => {
    // Restore original console methods
    jest.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log debug messages to console.debug', () => {
      browserLog('debug', 'TEST_CATEGORY', 'Debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'debug',
          category: 'TEST_CATEGORY',
          message: 'Debug message',
        })
      );
    });

    it('should log info messages to console.info', () => {
      browserLog('info', 'TEST_CATEGORY', 'Info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'info',
          category: 'TEST_CATEGORY',
          message: 'Info message',
        })
      );
    });

    it('should log warn messages to console.warn', () => {
      browserLog('warn', 'TEST_CATEGORY', 'Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'warn',
          category: 'TEST_CATEGORY',
          message: 'Warning message',
        })
      );
    });

    it('should log error messages to console.error', () => {
      browserLog('error', 'TEST_CATEGORY', 'Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'error',
          category: 'TEST_CATEGORY',
          message: 'Error message',
        })
      );
    });

    it('should include all required fields in log payload', () => {
      browserLog('info', 'CATEGORY', 'Message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[browserLog]', {
        level: 'info',
        category: 'CATEGORY',
        message: 'Message',
      });
    });
  });

  describe('structured data', () => {
    it('should include data in log payload when provided', () => {
      const data = { userId: '123', action: 'login' };

      browserLog('info', 'AUTH', 'User logged in', { data });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'info',
          category: 'AUTH',
          message: 'User logged in',
          data: { userId: '123', action: 'login' },
        })
      );
    });

    it('should not include data field when data is not provided', () => {
      browserLog('info', 'TEST', 'Message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[browserLog]', {
        level: 'info',
        category: 'TEST',
        message: 'Message',
      });

      const call = consoleInfoSpy.mock.calls[0][1];
      expect(call).not.toHaveProperty('data');
    });

    it('should handle complex data structures', () => {
      const complexData = {
        user: { id: 123, name: 'Alice' },
        metadata: { timestamp: '2024-01-01', source: 'api' },
        tags: ['important', 'user-action'],
      };

      browserLog('info', 'COMPLEX', 'Complex log', { data: complexData });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          data: complexData,
        })
      );
    });

    it('should handle null and undefined in data', () => {
      browserLog('info', 'NULL_DATA', 'Message', { data: null });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          data: null,
        })
      );
    });

    it('should handle primitive data types', () => {
      browserLog('info', 'STRING', 'Message', { data: 'string value' });
      browserLog('info', 'NUMBER', 'Message', { data: 42 });
      browserLog('info', 'BOOLEAN', 'Message', { data: true });

      expect(consoleInfoSpy).toHaveBeenNthCalledWith(
        1,
        '[browserLog]',
        expect.objectContaining({ data: 'string value' })
      );
      expect(consoleInfoSpy).toHaveBeenNthCalledWith(
        2,
        '[browserLog]',
        expect.objectContaining({ data: 42 })
      );
      expect(consoleInfoSpy).toHaveBeenNthCalledWith(
        3,
        '[browserLog]',
        expect.objectContaining({ data: true })
      );
    });
  });

  describe('OpenTelemetry span integration', () => {
    it('should not add span event by default', () => {
      browserLog('info', 'TEST', 'Message');

      expect(getActiveSpanSpy).not.toHaveBeenCalled();
      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });

    it('should add span event when asSpanEvent is true', () => {
      browserLog('info', 'TEST', 'Message', { asSpanEvent: true });

      expect(getActiveSpanSpy).toHaveBeenCalled();
      expect(mockSpan.addEvent).toHaveBeenCalledWith('browser.log', {
        'log.level': 'info',
        'log.category': 'TEST',
        'log.message': 'Message',
      });
    });

    it('should include data in span event when provided', () => {
      const data = { key: 'value' };

      browserLog('error', 'ERROR_CAT', 'Error occurred', {
        data,
        asSpanEvent: true,
      });

      expect(mockSpan.addEvent).toHaveBeenCalledWith('browser.log', {
        'log.level': 'error',
        'log.category': 'ERROR_CAT',
        'log.message': 'Error occurred',
        'log.data': JSON.stringify(data),
      });
    });

    it('should serialize complex data in span events', () => {
      const complexData = {
        nested: { value: 123 },
        array: [1, 2, 3],
      };

      browserLog('info', 'TEST', 'Message', {
        data: complexData,
        asSpanEvent: true,
      });

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'browser.log',
        expect.objectContaining({
          'log.data': JSON.stringify(complexData),
        })
      );
    });

    it('should handle case when no active span exists', () => {
      getActiveSpanSpy.mockReturnValue(undefined);

      // Should not throw error
      expect(() => {
        browserLog('info', 'TEST', 'Message', { asSpanEvent: true });
      }).not.toThrow();

      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });

    it('should not include log.data attribute when data is undefined', () => {
      browserLog('info', 'TEST', 'Message', { asSpanEvent: true });

      expect(mockSpan.addEvent).toHaveBeenCalledWith('browser.log', {
        'log.level': 'info',
        'log.category': 'TEST',
        'log.message': 'Message',
      });

      const attributes = mockSpan.addEvent.mock.calls[0][1];
      expect(attributes).not.toHaveProperty('log.data');
    });
  });

  describe('log levels', () => {
    const levels: BrowserLogLevel[] = ['debug', 'info', 'warn', 'error'];

    levels.forEach((level) => {
      it(`should handle ${level} level correctly`, () => {
        browserLog(level, 'CATEGORY', 'Message');

        // Verify correct console method was called
        const expectedSpy =
          level === 'error'
            ? consoleErrorSpy
            : level === 'warn'
            ? consoleWarnSpy
            : level === 'info'
            ? consoleInfoSpy
            : consoleDebugSpy;

        expect(expectedSpy).toHaveBeenCalledWith(
          '[browserLog]',
          expect.objectContaining({ level })
        );
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should log user authentication event', () => {
      browserLog('info', 'AUTH', 'User logged in successfully', {
        data: {
          userId: 'user-123',
          timestamp: '2024-01-01T10:00:00Z',
          method: 'oauth',
        },
        asSpanEvent: true,
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'browser.log',
        expect.objectContaining({
          'log.category': 'AUTH',
          'log.message': 'User logged in successfully',
        })
      );
    });

    it('should log API error', () => {
      browserLog('error', 'API', 'Failed to fetch user data', {
        data: {
          endpoint: '/api/users/123',
          status: 404,
          error: 'Not Found',
        },
        asSpanEvent: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'error',
          category: 'API',
          message: 'Failed to fetch user data',
        })
      );
    });

    it('should log performance metric', () => {
      browserLog('info', 'PERFORMANCE', 'Page load completed', {
        data: {
          duration: 1234,
          resources: 42,
          domContentLoaded: 856,
        },
      });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          category: 'PERFORMANCE',
          data: expect.objectContaining({
            duration: 1234,
            resources: 42,
          }),
        })
      );
    });

    it('should log debug information during development', () => {
      browserLog('debug', 'DEVELOPMENT', 'Component rendered', {
        data: {
          component: 'UserProfile',
          props: { userId: '123' },
          renderCount: 5,
        },
      });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          level: 'debug',
          category: 'DEVELOPMENT',
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      browserLog('info', '', '');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[browserLog]', {
        level: 'info',
        category: '',
        message: '',
      });
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);

      browserLog('info', 'LONG', longMessage);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          message: longMessage,
        })
      );
    });

    it('should handle special characters in strings', () => {
      browserLog(
        'info',
        'SPECIAL',
        'Message with \n newlines \t tabs " quotes'
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          message: 'Message with \n newlines \t tabs " quotes',
        })
      );
    });

    it('should handle unicode and emoji', () => {
      browserLog('info', 'UNICODE', '日本語 🚀 émojis');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[browserLog]',
        expect.objectContaining({
          message: '日本語 🚀 émojis',
        })
      );
    });

    it('should handle circular references in data gracefully during span serialization', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should not throw when logging to console (data is included as-is)
      expect(() => {
        browserLog('info', 'CIRCULAR', 'Message', { data: circular });
      }).not.toThrow();

      // Should throw when trying to add as span event (JSON.stringify fails)
      expect(() => {
        browserLog('info', 'CIRCULAR', 'Message', {
          data: circular,
          asSpanEvent: true,
        });
      }).toThrow();
    });
  });
});
