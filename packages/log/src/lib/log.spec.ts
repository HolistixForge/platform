import { Logger, EPriority, log, error } from './log';

/**
 * TESTING LOGGER UTILITY
 * 
 * This test suite demonstrates:
 * - Testing logging infrastructure
 * - Testing priority/severity level mapping
 * - Testing static class methods
 * - Mocking OpenTelemetry dependencies
 * - Testing environment-based configuration
 */

// Mock OpenTelemetry dependencies
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: jest.fn(() => null),
  },
}));

jest.mock('@opentelemetry/sdk-logs', () => ({
  LoggerProvider: jest.fn().mockImplementation(() => ({
    getLogger: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
  SimpleLogRecordProcessor: jest.fn(),
}));

jest.mock('@opentelemetry/exporter-logs-otlp-proto', () => ({
  OTLPLogExporter: jest.fn(),
}));

jest.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: jest.fn(() => ({})),
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
  SEMRESATTRS_SERVICE_NAME: 'service.name',
}));

describe('Logger', () => {
  describe('EPriority enum', () => {
    it('should have all expected priority levels', () => {
      expect(EPriority.Emergency).toBe('emergency');
      expect(EPriority.Alert).toBe('alert');
      expect(EPriority.Critical).toBe('critical');
      expect(EPriority.Error).toBe('error');
      expect(EPriority.Warning).toBe('warning');
      expect(EPriority.Notice).toBe('notice');
      expect(EPriority.Info).toBe('info');
      expect(EPriority.Debug).toBe('debug');
    });

    it('should have string values', () => {
      const values = Object.values(EPriority);
      values.forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    it('should have 8 priority levels', () => {
      const keys = Object.keys(EPriority);
      expect(keys.length).toBe(8);
    });
  });

  describe('Logger instance methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger();
    });

    it('should create a logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should have log method', () => {
      expect(typeof logger.log).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should call log method with EPriority.Error when using error method', () => {
      const logSpy = jest.spyOn(logger, 'log');
      
      logger.error('TEST', 'test message', { foo: 'bar' });
      
      expect(logSpy).toHaveBeenCalledWith(
        EPriority.Error,
        'TEST',
        'test message',
        { foo: 'bar' }
      );
    });

    it('should handle log call without data', () => {
      expect(() => {
        logger.log(EPriority.Info, 'TEST', 'test message');
      }).not.toThrow();
    });

    it('should handle log call with data', () => {
      expect(() => {
        logger.log(EPriority.Debug, 'TEST', 'test message', { key: 'value' });
      }).not.toThrow();
    });
  });

  describe('Logger static methods', () => {
    it('should have static log method', () => {
      expect(typeof Logger.log).toBe('function');
    });

    it('should have static error method', () => {
      expect(typeof Logger.error).toBe('function');
    });

    it('should have setPriority method', () => {
      expect(typeof Logger.setPriority).toBe('function');
    });

    it('should have setLogger method', () => {
      expect(typeof Logger.setLogger).toBe('function');
    });

    it('should have initialize method', () => {
      expect(typeof Logger.initialize).toBe('function');
    });

    it('should have isInitialized method', () => {
      expect(typeof Logger.isInitialized).toBe('function');
    });

    it('should allow setting custom logger instance', () => {
      const customLogger = new Logger();
      const logSpy = jest.spyOn(customLogger, 'log');
      
      Logger.setLogger(customLogger);
      Logger.log(EPriority.Info, 'TEST', 'test message');
      
      expect(logSpy).toHaveBeenCalled();
    });

    it('should allow setting priority level', () => {
      const originalPriority = (Logger as any)._priority;
      
      Logger.setPriority(EPriority.Error);
      expect((Logger as any)._priority).toBe(EPriority.Error);
      
      // Restore original
      Logger.setPriority(originalPriority);
    });
  });

  describe('Priority filtering', () => {
    let mockLogger: Logger;

    beforeEach(() => {
      mockLogger = new Logger();
      jest.spyOn(mockLogger, 'log');
      Logger.setLogger(mockLogger);
    });

    it('should log when message priority is equal to logger priority', () => {
      Logger.setPriority(EPriority.Info);
      Logger.log(EPriority.Info, 'TEST', 'test message');
      
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should log when message priority is higher than logger priority', () => {
      Logger.setPriority(EPriority.Info);
      Logger.log(EPriority.Error, 'TEST', 'test message');
      
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should not log when message priority is lower than logger priority', () => {
      Logger.setPriority(EPriority.Info);
      Logger.log(EPriority.Debug, 'TEST', 'test message');
      
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should log emergency messages at any priority level', () => {
      Logger.setPriority(EPriority.Debug);
      Logger.log(EPriority.Emergency, 'TEST', 'emergency message');
      
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should respect priority hierarchy', () => {
      jest.clearAllMocks();
      Logger.setPriority(EPriority.Warning);
      
      // Should log (higher or equal priority)
      Logger.log(EPriority.Emergency, 'TEST', 'msg');
      Logger.log(EPriority.Alert, 'TEST', 'msg');
      Logger.log(EPriority.Critical, 'TEST', 'msg');
      Logger.log(EPriority.Error, 'TEST', 'msg');
      Logger.log(EPriority.Warning, 'TEST', 'msg');
      
      expect(mockLogger.log).toHaveBeenCalledTimes(5);
      
      jest.clearAllMocks();
      
      // Should not log (lower priority)
      Logger.log(EPriority.Notice, 'TEST', 'msg');
      Logger.log(EPriority.Info, 'TEST', 'msg');
      Logger.log(EPriority.Debug, 'TEST', 'msg');
      
      expect(mockLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('Exported convenience functions', () => {
    let mockLogger: Logger;

    beforeEach(() => {
      mockLogger = new Logger();
      jest.spyOn(mockLogger, 'log');
      jest.spyOn(mockLogger, 'error');
      Logger.setLogger(mockLogger);
      Logger.setPriority(EPriority.Debug); // Allow all logs
    });

    it('should export log function', () => {
      expect(typeof log).toBe('function');
    });

    it('should export error function', () => {
      expect(typeof error).toBe('function');
    });

    it('log function should call Logger static log', () => {
      // The log function is already bound to Logger.log, so we check if the underlying logger.log is called
      jest.clearAllMocks();
      
      log(EPriority.Info, 'TEST', 'test message');
      
      // Check that the mockLogger.log was called
      expect(mockLogger.log).toHaveBeenCalledWith(EPriority.Info, 'TEST', 'test message', undefined);
    });

    it('error function should call Logger static error', () => {
      // The error function is already bound to Logger.error
      jest.clearAllMocks();
      
      error('TEST', 'error message', { err: 'details' });
      
      // Check that the mockLogger.error was called
      expect(mockLogger.error).toHaveBeenCalledWith('TEST', 'error message', { err: 'details' });
    });

    it('error function should eventually call logger.log with Error priority', () => {
      error('TEST', 'error message');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        EPriority.Error,
        'TEST',
        'error message',
        undefined
      );
    });
  });

  describe('Logger initialization', () => {
    it('should not throw when initializing without options', () => {
      expect(() => {
        Logger.initialize();
      }).not.toThrow();
    });

    it('should not throw when initializing with options', () => {
      expect(() => {
        Logger.initialize({
          otlpEndpointHttp: 'http://localhost:4318',
          serviceName: 'test-service',
        });
      }).not.toThrow();
    });

    it('should handle browser environment gracefully', () => {
      // Mock browser environment
      (global as any).window = {};
      
      expect(() => {
        Logger.initialize();
      }).not.toThrow();
      
      delete (global as any).window;
    });

    it('should allow checking initialization status', () => {
      const initialized = Logger.isInitialized();
      expect(typeof initialized).toBe('boolean');
    });
  });

  describe('Edge cases', () => {
    let mockLogger: Logger;

    beforeEach(() => {
      mockLogger = new Logger();
      jest.spyOn(mockLogger, 'log');
      Logger.setLogger(mockLogger);
      Logger.setPriority(EPriority.Debug);
    });

    it('should handle undefined data parameter', () => {
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', 'message', undefined);
      }).not.toThrow();
    });

    it('should handle null data parameter', () => {
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', 'message', null as any);
      }).not.toThrow();
    });

    it('should handle empty string message', () => {
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', '');
      }).not.toThrow();
    });

    it('should handle empty category', () => {
      expect(() => {
        Logger.log(EPriority.Info, '', 'message');
      }).not.toThrow();
    });

    it('should handle complex data objects', () => {
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', 'message', {
          nested: { object: { with: 'values' } },
          array: [1, 2, 3],
          string: 'value',
          number: 42,
          boolean: true,
        });
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', 'Special chars: \n\t"quotes"\' & <html>');
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      expect(() => {
        Logger.log(EPriority.Info, 'TEST', longMessage);
      }).not.toThrow();
    });

    it('should handle all priority levels', () => {
      const priorities = [
        EPriority.Emergency,
        EPriority.Alert,
        EPriority.Critical,
        EPriority.Error,
        EPriority.Warning,
        EPriority.Notice,
        EPriority.Info,
        EPriority.Debug,
      ];

      priorities.forEach(priority => {
        expect(() => {
          Logger.log(priority, 'TEST', `Testing ${priority}`);
        }).not.toThrow();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work with multiple loggers', () => {
      const logger1 = new Logger();
      const logger2 = new Logger();
      
      const spy1 = jest.spyOn(logger1, 'log');
      const spy2 = jest.spyOn(logger2, 'log');
      
      Logger.setLogger(logger1);
      Logger.setPriority(EPriority.Debug);
      Logger.log(EPriority.Info, 'TEST', 'message 1');
      
      expect(spy1).toHaveBeenCalled();
      expect(spy2).not.toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      Logger.setLogger(logger2);
      Logger.log(EPriority.Info, 'TEST', 'message 2');
      
      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    it('should handle priority changes dynamically', () => {
      const mockLogger = new Logger();
      jest.spyOn(mockLogger, 'log');
      Logger.setLogger(mockLogger);
      
      Logger.setPriority(EPriority.Error);
      Logger.log(EPriority.Debug, 'TEST', 'should not log');
      expect(mockLogger.log).not.toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      Logger.setPriority(EPriority.Debug);
      Logger.log(EPriority.Debug, 'TEST', 'should log now');
      expect(mockLogger.log).toHaveBeenCalled();
    });
  });
});

