/**
 * Tests for exception classes
 * 
 * Tests custom exception classes used throughout the application
 * for consistent error handling and categorization.
 */

import {
  Exception,
  UserException,
  ForbiddenException,
  NotFoundException,
  UnknownException,
  OneError,
  ErrorCategory,
} from './exceptions';

describe('Exception Classes', () => {
  describe('Exception', () => {
    describe('constructor', () => {
      it('should create an exception with default values', () => {
        const exception = new Exception();

        expect(exception._uuid).toBeDefined();
        expect(exception._uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(exception._errors).toEqual([]);
        expect(exception.httpStatus).toBeUndefined();
        expect(exception._previous).toBeUndefined();
        expect(exception.errorCategory).toBe('APP_ERROR');
      });

      it('should create an exception with errors', () => {
        const errors: OneError[] = [
          { message: 'Error 1', public: true },
          { message: 'Error 2' },
        ];
        const exception = new Exception(errors);

        expect(exception._errors).toEqual(errors);
      });

      it('should create an exception with HTTP status', () => {
        const exception = new Exception([], 404);

        expect(exception.httpStatus).toBe(404);
      });

      it('should create an exception with previous error', () => {
        const previousError = new Error('Previous error');
        const exception = new Exception([], undefined, previousError);

        expect(exception._previous).toBe(previousError);
        expect(exception._errors).toContainEqual({
          message: 'Error: Previous error',
        });
      });

      it('should append previous error message to errors array', () => {
        const previousError = new Error('Database connection failed');
        const errors: OneError[] = [{ message: 'Initial error', public: true }];
        const exception = new Exception(errors, 500, previousError);

        expect(exception._errors).toHaveLength(2);
        expect(exception._errors[1].message).toBe(
          'Error: Database connection failed'
        );
      });

      it('should generate unique UUIDs for different exceptions', () => {
        const exception1 = new Exception();
        const exception2 = new Exception();

        expect(exception1._uuid).not.toBe(exception2._uuid);
      });

      it('should capture stack trace when available', () => {
        const exception = new Exception();

        expect(exception.stack).toBeDefined();
        // Stack trace should contain error information
        expect(typeof exception.stack).toBe('string');
        expect(exception.stack!.length).toBeGreaterThan(0);
      });
    });

    describe('error categorization', () => {
      it('should classify 4xx errors as USER_ERROR', () => {
        const exception400 = new Exception([], 400);
        const exception404 = new Exception([], 404);
        const exception499 = new Exception([], 499);

        expect(exception400.errorCategory).toBe('USER_ERROR');
        expect(exception404.errorCategory).toBe('USER_ERROR');
        expect(exception499.errorCategory).toBe('USER_ERROR');
      });

      it('should classify 5xx errors as APP_ERROR', () => {
        const exception500 = new Exception([], 500);
        const exception503 = new Exception([], 503);
        const exception599 = new Exception([], 599);

        expect(exception500.errorCategory).toBe('APP_ERROR');
        expect(exception503.errorCategory).toBe('APP_ERROR');
        expect(exception599.errorCategory).toBe('APP_ERROR');
      });

      it('should default to APP_ERROR for errors without status', () => {
        const exception = new Exception([]);

        expect(exception.errorCategory).toBe('APP_ERROR');
      });

      it('should use explicit error category when provided', () => {
        const exception = new Exception([], 200, undefined, 'SYSTEM_ERROR');

        expect(exception.errorCategory).toBe('SYSTEM_ERROR');
      });

      it('should allow manual override of error category', () => {
        const exception = new Exception([], 400); // Would be USER_ERROR
        expect(exception.errorCategory).toBe('USER_ERROR');

        exception.setErrorCategory('SYSTEM_ERROR');
        expect(exception.errorCategory).toBe('SYSTEM_ERROR');
      });
    });

    describe('toJson', () => {
      it('should return only public errors in errors field', () => {
        const errors: OneError[] = [
          { message: 'Public error 1', public: true },
          { message: 'Private error 1' },
          { message: 'Public error 2', public: true },
          { message: 'Private error 2' },
        ];
        const exception = new Exception(errors);

        const json = exception.toJson();

        expect(json.errors).toHaveLength(2);
        expect(json.errors).toContainEqual({ message: 'Public error 1', public: true });
        expect(json.errors).toContainEqual({ message: 'Public error 2', public: true });
      });

      it('should return only non-public errors in dev field', () => {
        const errors: OneError[] = [
          { message: 'Public error', public: true },
          { message: 'Private error 1' },
          { message: 'Private error 2' },
        ];
        const exception = new Exception(errors);

        const json = exception.toJson();

        expect(json.dev).toHaveLength(2);
        expect(json.dev).toContainEqual({ message: 'Private error 1' });
        expect(json.dev).toContainEqual({ message: 'Private error 2' });
      });

      it('should include uuid in JSON output', () => {
        const exception = new Exception();

        const json = exception.toJson();

        expect(json.uuid).toBe(exception._uuid);
      });

      it('should include stack trace in JSON output', () => {
        const exception = new Exception();

        const json = exception.toJson();

        expect(json).toHaveProperty('stack');
      });

      it('should handle exception with no errors', () => {
        const exception = new Exception([]);

        const json = exception.toJson();

        expect(json.errors).toEqual([]);
        expect(json.dev).toEqual([]);
      });
    });
  });

  describe('UserException', () => {
    it('should create a user exception with public message', () => {
      const exception = new UserException('Invalid input');

      expect(exception._errors).toHaveLength(1);
      expect(exception._errors[0]).toEqual({
        message: 'Invalid input',
        public: true,
      });
    });

    it('should set HTTP status to 400', () => {
      const exception = new UserException('Invalid input');

      expect(exception.httpStatus).toBe(400);
    });

    it('should set error category to USER_ERROR', () => {
      const exception = new UserException('Invalid input');

      expect(exception.errorCategory).toBe('USER_ERROR');
    });

    it('should generate unique UUID', () => {
      const exception = new UserException('Error');

      expect(exception._uuid).toBeDefined();
      expect(exception._uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should expose message in toJson() output', () => {
      const exception = new UserException('Invalid email format');

      const json = exception.toJson();

      expect(json.errors).toContainEqual({
        message: 'Invalid email format',
        public: true,
      });
    });
  });

  describe('ForbiddenException', () => {
    it('should create a forbidden exception with default message', () => {
      const exception = new ForbiddenException();

      expect(exception._errors).toContainEqual({
        message: 'Forbidden',
        public: true,
        default: true,
      });
    });

    it('should set HTTP status to 403', () => {
      const exception = new ForbiddenException();

      expect(exception.httpStatus).toBe(403);
    });

    it('should set error category to USER_ERROR', () => {
      const exception = new ForbiddenException();

      expect(exception.errorCategory).toBe('USER_ERROR');
    });

    it('should accept additional errors', () => {
      const additionalErrors: OneError[] = [
        { message: 'Insufficient permissions', public: true },
      ];
      const exception = new ForbiddenException(additionalErrors);

      expect(exception._errors).toHaveLength(2);
      expect(exception._errors).toContainEqual({
        message: 'Insufficient permissions',
        public: true,
      });
      expect(exception._errors).toContainEqual({
        message: 'Forbidden',
        public: true,
        default: true,
      });
    });

    it('should accept previous error', () => {
      const previousError = new Error('Auth token expired');
      const exception = new ForbiddenException([], previousError);

      expect(exception._previous).toBe(previousError);
      expect(exception._errors).toContainEqual({
        message: 'Error: Auth token expired',
      });
    });
  });

  describe('NotFoundException', () => {
    it('should create a not found exception with default message', () => {
      const exception = new NotFoundException();

      expect(exception._errors).toContainEqual({
        message: 'Not Found',
        public: true,
        default: true,
      });
    });

    it('should set HTTP status to 404', () => {
      const exception = new NotFoundException();

      expect(exception.httpStatus).toBe(404);
    });

    it('should set error category to USER_ERROR', () => {
      const exception = new NotFoundException();

      expect(exception.errorCategory).toBe('USER_ERROR');
    });

    it('should accept additional errors', () => {
      const additionalErrors: OneError[] = [
        { message: 'User with ID 123 not found', public: true },
      ];
      const exception = new NotFoundException(additionalErrors);

      expect(exception._errors).toHaveLength(2);
      expect(exception._errors).toContainEqual({
        message: 'User with ID 123 not found',
        public: true,
      });
      expect(exception._errors).toContainEqual({
        message: 'Not Found',
        public: true,
        default: true,
      });
    });

    it('should expose errors in toJson() output', () => {
      const exception = new NotFoundException([
        { message: 'Resource not found', public: true },
      ]);

      const json = exception.toJson();

      expect(json.errors).toHaveLength(2);
    });
  });

  describe('UnknownException', () => {
    it('should create an unknown exception with default public message', () => {
      const exception = new UnknownException('Unexpected error occurred');

      expect(exception._errors).toContainEqual({
        message: 'UNKNOWN ERROR',
        public: true,
        default: true,
      });
    });

    it('should include private error message', () => {
      const exception = new UnknownException('Database query failed');

      expect(exception._errors).toContainEqual({
        message: 'Database query failed',
      });
    });

    it('should set HTTP status to 500', () => {
      const exception = new UnknownException('Error');

      expect(exception.httpStatus).toBe(500);
    });

    it('should set error category to APP_ERROR', () => {
      const exception = new UnknownException('Error');

      expect(exception.errorCategory).toBe('APP_ERROR');
    });

    it('should hide internal error details from public JSON', () => {
      const exception = new UnknownException('Sensitive database error');

      const json = exception.toJson();

      expect(json.errors).not.toContainEqual({
        message: 'Sensitive database error',
      });
      expect(json.dev).toContainEqual({
        message: 'Sensitive database error',
      });
    });
  });

  describe('error handling scenarios', () => {
    it('should handle chained exceptions', () => {
      const rootError = new Error('Database connection lost');
      const exception1 = new Exception(
        [{ message: 'Failed to fetch user' }],
        500,
        rootError
      );
      const exception2 = new Exception(
        [{ message: 'API request failed' }],
        500,
        exception1
      );

      // Exception message is empty string, so format is "Exception: "
      expect(exception2._errors).toContainEqual({
        message: 'Exception: ',
      });
      expect(exception2._previous).toBe(exception1);
    });

    it('should preserve error information across conversions', () => {
      const errors: OneError[] = [
        { message: 'Public error', public: true },
        { message: 'Private error' },
      ];
      const exception = new Exception(errors, 400);

      const json = exception.toJson();
      expect(json.uuid).toBeDefined();
      expect(json.errors).toHaveLength(1);
      expect(json.dev).toHaveLength(1);
    });

    it('should handle exception with only public errors', () => {
      const errors: OneError[] = [
        { message: 'Error 1', public: true },
        { message: 'Error 2', public: true },
      ];
      const exception = new Exception(errors);

      const json = exception.toJson();
      expect(json.errors).toHaveLength(2);
      expect(json.dev).toHaveLength(0);
    });

    it('should handle exception with only private errors', () => {
      const errors: OneError[] = [{ message: 'Error 1' }, { message: 'Error 2' }];
      const exception = new Exception(errors);

      const json = exception.toJson();
      expect(json.errors).toHaveLength(0);
      expect(json.dev).toHaveLength(2);
    });
  });

  describe('instanceof checks', () => {
    it('should be instance of Error', () => {
      const exception = new Exception();

      expect(exception instanceof Error).toBe(true);
    });

    it('should be instance of Exception', () => {
      const exception = new Exception();

      expect(exception instanceof Exception).toBe(true);
    });

    it('UserException should be instance of Exception', () => {
      const exception = new UserException('Error');

      expect(exception instanceof Exception).toBe(true);
    });

    it('ForbiddenException should be instance of Exception', () => {
      const exception = new ForbiddenException();

      expect(exception instanceof Exception).toBe(true);
    });

    it('NotFoundException should be instance of Exception', () => {
      const exception = new NotFoundException();

      expect(exception instanceof Exception).toBe(true);
    });

    it('UnknownException should be instance of Exception', () => {
      const exception = new UnknownException('Error');

      expect(exception instanceof Exception).toBe(true);
    });
  });
});

