import { TMyfetchRequest } from '@monorepo/simple-types';
import { MyfetchResponse } from '../utils/fetch';
import { OneError, Exception, SystemException } from '@monorepo/log';

//
//
//

type ApiErrors = {
  errors: OneError[];
};

/**
 * create an Exception from a nested API call error to be forwarded as is.
 */
export class ForwardException extends Exception {
  constructor(req: TMyfetchRequest, res: MyfetchResponse) {
    super([], res.statusCode);
    this._errors = (res.json as ApiErrors)?.errors || [];
    this._errors.push({
      message: `from [${req.url}], statusCode: ${res.statusCode}`,
    });
  }
}

export class EpDefinitionException extends SystemException {}

export class SqlException extends SystemException {}

export class ConfigException extends SystemException {}

export class RunException extends SystemException {}

export class EC2Exception extends SystemException {}

export class OAuthRefreshTokenException extends Exception {
  constructor() {
    super([{ message: `REFRESH_TOKEN`, public: true }], 401);
  }
}

export class OpenapiException extends Exception {
  constructor(
    err: Error & { name: 'Bad Request'; status: 400; errors: OneError[] }
  ) {
    super(
      err.errors.map((e) => ({ ...e, public: true })),
      400,
      err
    );
  }
}
