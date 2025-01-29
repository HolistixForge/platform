import { TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { MyfetchResponse } from '../utils/fetch';

//
//
//

type MyError = { message: string; public?: boolean; default?: boolean };

type ApiErrors = {
  errors: MyError[];
};

//
//
//

export class Exception extends Error {
  httpStatus: number;
  _uuid: string;
  _errors: MyError[];
  _previous: Error | undefined;

  constructor(sc: number, errors: MyError[] = [], previous?: Error) {
    super();
    this._uuid = makeUuid();
    this.httpStatus = sc;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stack: (this as any).stackTrace,
      dev: this._errors.filter((e) => !e.public),
    };
  }
}

/**
 * create an Exception from a nested API call error to be forwarded as is.
 */
export class ForwardException extends Exception {
  constructor(req: TMyfetchRequest, res: MyfetchResponse) {
    super(res.statusCode);
    this._errors = (res.json as ApiErrors).errors;
    this._errors.push({ message: `from [${req.url}]` });
  }
}

/**
 * create an exception for an error due to user usage
 */
export class UserException extends Exception {
  constructor(msg: string) {
    super(400, [{ message: msg, public: true }]);
  }
}

export class ForbiddenException extends Exception {
  constructor(errors: MyError[] = [], previous?: Error) {
    errors.push({ message: 'Forbidden', public: true, default: true });
    super(403, errors, previous);
  }
}

export class NotFoundException extends Exception {
  constructor(errors: MyError[] = []) {
    errors.push({ message: 'Not Found', public: true, default: true });
    super(404, errors);
  }
}

//
//
//

abstract class SystemException extends Exception {
  constructor(msg: string) {
    super(500, [
      { message: 'Sorry, System error', public: true, default: true },
      { message: msg },
    ]);
  }
}

export class EpDefinitionException extends SystemException {}

export class SqlException extends SystemException {}

export class ConfigException extends SystemException {}

export class RunException extends SystemException {}

export class EC2Exception extends SystemException {}

export class UnknownException extends Exception {
  constructor(msg: string) {
    super(500, [
      { message: 'UNKNOWN ERROR', public: true, default: true },
      { message: msg },
    ]);
  }
}

//
//
//

export class OAuthRefreshTokenException extends Exception {
  constructor() {
    super(401, [{ message: `REFRESH_TOKEN`, public: true }]);
  }
}

export class OpenapiException extends Exception {
  constructor(
    err: Error & { name: 'Bad Request'; status: 400; errors: MyError[] }
  ) {
    super(
      400,
      err.errors.map((e) => ({ ...e, public: true })),
      err
    );
  }
}
