import { makeUuid } from '@monorepo/simple-types';

//

export type OneError = { message: string; public?: boolean; default?: boolean };

export type ErrorCategory = 'APP_ERROR' | 'USER_ERROR' | 'SYSTEM_ERROR';

//

export class Exception extends Error {
  httpStatus?: number;
  _uuid: string;
  _errors: OneError[];
  _previous: Error | undefined;
  _errorCategory: ErrorCategory;

  constructor(
    errors: OneError[] = [],
    httpStatus?: number,
    previous?: Error,
    errorCategory?: ErrorCategory
  ) {
    super();
    this._uuid = makeUuid();
    this.httpStatus = httpStatus;
    this._errors = errors;
    this._previous = previous;
    // Auto-classify if not provided
    this._errorCategory =
      errorCategory || this._classifyError(httpStatus, errors);

    if (this._previous)
      this._errors.push({
        message: `${this._previous.constructor.name}: ${this._previous.message}`,
      });

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
    }
  }

  /**
   * Auto-classify error based on HTTP status and error type
   */
  private _classifyError(
    httpStatus?: number,
    errors?: OneError[]
  ): ErrorCategory {
    // 4xx errors are typically user errors
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return 'USER_ERROR';
    }
    // 5xx errors are typically app/system errors
    if (httpStatus && httpStatus >= 500) {
      return 'APP_ERROR';
    }
    // Default to APP_ERROR for unclassified errors
    return 'APP_ERROR';
  }

  /**
   * Get error category
   */
  get errorCategory(): ErrorCategory {
    return this._errorCategory;
  }

  /**
   * Set error category (allows manual override)
   */
  setErrorCategory(category: ErrorCategory): void {
    this._errorCategory = category;
  }

  toJson() {
    return {
      uuid: this._uuid,
      errors: this._errors.filter((e) => e.public),

      stack: (this as any).stackTrace,
      dev: this._errors.filter((e) => !e.public),
    };
  }
}

/**
 * create an exception for an error due to user usage
 */
export class UserException extends Exception {
  constructor(msg: string) {
    super([{ message: msg, public: true }], 400, undefined, 'USER_ERROR');
  }
}

export class ForbiddenException extends Exception {
  constructor(errors: OneError[] = [], previous?: Error) {
    errors.push({ message: 'Forbidden', public: true, default: true });
    super(errors, 403, previous, 'USER_ERROR');
  }
}

export class NotFoundException extends Exception {
  constructor(errors: OneError[] = []) {
    errors.push({ message: 'Not Found', public: true, default: true });
    super(errors, 404, undefined, 'USER_ERROR');
  }
}

export abstract class SystemException extends Exception {
  constructor(msg: string) {
    super(
      [
        { message: 'Sorry, System error', public: true, default: true },
        { message: msg },
      ],
      500,
      undefined,
      'APP_ERROR'
    );
  }
}

export class UnknownException extends Exception {
  constructor(msg: string) {
    super(
      [
        { message: 'UNKNOWN ERROR', public: true, default: true },
        { message: msg },
      ],
      500,
      undefined,
      'APP_ERROR'
    );
  }
}
