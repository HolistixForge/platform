import { makeUuid } from '@monorepo/simple-types';

//

export type OneError = { message: string; public?: boolean; default?: boolean };

//

export class Exception extends Error {
  httpStatus?: number;
  _uuid: string;
  _errors: OneError[];
  _previous: Error | undefined;

  constructor(errors: OneError[] = [], httpStatus?: number, previous?: Error) {
    super();
    this._uuid = makeUuid();
    this.httpStatus = httpStatus;
    this._errors = errors;
    this._previous = previous;

    if (this._previous)
      this._errors.push({
        message: `${this._previous.constructor.name}: ${this._previous.message}`,
      });

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
    }
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
    super([{ message: msg, public: true }], 400);
  }
}

export class ForbiddenException extends Exception {
  constructor(errors: OneError[] = [], previous?: Error) {
    errors.push({ message: 'Forbidden', public: true, default: true });
    super(errors, 403, previous);
  }
}

export class NotFoundException extends Exception {
  constructor(errors: OneError[] = []) {
    errors.push({ message: 'Not Found', public: true, default: true });
    super(errors, 404);
  }
}

export abstract class SystemException extends Exception {
  constructor(msg: string) {
    super(
      [
        { message: 'Sorry, System error', public: true, default: true },
        { message: msg },
      ],
      500
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
      500
    );
  }
}
