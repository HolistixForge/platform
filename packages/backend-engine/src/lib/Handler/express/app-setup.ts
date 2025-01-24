import express from 'express';
import nocache from 'nocache';
import cookieParser from 'cookie-parser';
import { EColor, error, log } from '@monorepo/log';
import { respond } from './responses';
import {
  Exception,
  NotFoundException,
  OpenapiException,
  UnknownException,
} from '../../Exceptions/Exception';
import { jaegerSetError, setupJaegerLog } from '../../Logs/jaeger';

export type BasicExpressAppOptions = {
  jaeger?: {
    serviceName: string;
    serviceTag: string;
    host: string;
  };
};

//

export const setupBasicExpressApp = (
  app: express.Express,
  options?: BasicExpressAppOptions
) => {
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Powered-By', '');
    next();
  });

  // disable express caching
  app.use(nocache());
  app.set('etag', false);

  // load JSON from POST, PATCH ... request body
  app.use(express.json());

  // load from "application/x-www-form-urlencoded"
  app.use(express.urlencoded({ extended: true }));

  app.use(cookieParser());

  if (options?.jaeger) {
    const { serviceName, serviceTag, host } = options.jaeger;
    setupJaegerLog(app, serviceName, serviceTag, host);
  }

  // log any request
  app.use((req, res, next) => {
    log(6, 'REQUEST', `${req.method}: ${req.path}`, null, EColor.BgYellow);
    const { headers, method, params, query } = req;

    const rd = {
      method,
      json: req.body,
      query,
      headers,
      params,
    };
    log(6, 'REQUEST', ``, rd, EColor.FgYellow);
    next();
  });
};

//

export const setupErrorsHandler = (app: express.Express) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(function (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let exception: Exception;
    // if we reach this app.use block, it is an error

    // if openapi validator error ?
    // tested first because not our standard Exception
    if (
      err.name === 'Bad Request' &&
      err.status === 400 &&
      Array.isArray(err.errors)
    )
      exception = new OpenapiException(err);
    // if openapi validator not found ?
    else if (
      err.name === 'Not Found' &&
      err.status === 404 &&
      Array.isArray(err.errors)
    )
      exception = new NotFoundException(err.errors);
    //
    // if it is not our standard Exception
    // something bad happen
    else if (!(err instanceof Exception)) {
      console.log(err);
      exception = new UnknownException(err.message);
    }
    //
    else exception = err;

    const json = exception.toJson();

    const serialized = JSON.stringify(json, null, 4);
    error('Error', serialized, exception.stack);

    jaegerSetError(req, exception);

    const { uuid, errors } = json;

    respond(req, res, {
      type: 'json',
      json: { uuid, errors },
      status: exception.httpStatus,
    });
  });
};
