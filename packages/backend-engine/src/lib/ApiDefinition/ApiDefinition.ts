import { DeepReadonly } from 'ts-essentials';

import { NotFoundException } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';

import { Request } from '../Request/Request';

export type TApiPoint = {
  selector: string | boolean;
  eventSource?: boolean;
  'exec-pipe-id': string;
};

type TMethod = {
  summary?: string;
  description?: string;
  parameters?: TJson[];
  responses?: {
    [statusCode: string]: TJson;
  };
  'x-backend-engine': {
    points: TApiPoint[];
  };
};

type TOpenApi = {
  paths: {
    [path: string]: {
      get?: TMethod;
      post?: TMethod;
      patch?: TMethod;
      put?: TMethod;
      delete?: TMethod;
    };
  };
};

//
//
//
//

export class ApiDefinition {
  _oas30: DeepReadonly<TOpenApi>;

  constructor(oas: TOpenApi) {
    this._oas30 = oas as TOpenApi;
  }

  get paths() {
    return this._oas30.paths;
  }

  routeRequest = (request: Request): DeepReadonly<TMethod> => {
    const path = this._oas30.paths[request.path];
    if (!path) throw new NotFoundException([{ message: `No such resource` }]);

    const method =
      path[
        request.httpMethod.toLowerCase() as
          | 'get'
          | 'put'
          | 'post'
          | 'delete'
          | 'patch'
      ];
    if (!method)
      throw new NotFoundException([
        { message: `No such method [${request.path}]:[${request.httpMethod}]` },
      ]);

    return method;
  };
}
