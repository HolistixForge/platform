import express from 'express';
import nocache from 'nocache';
import cookieParser from 'cookie-parser';

import {
  error,
  log,
  Exception,
  NotFoundException,
  UnknownException,
  EPriority,
} from '@holistix-forge/log';
import { TJson } from '@holistix-forge/simple-types';

import { respond } from './responses';
import { trace, SpanStatusCode } from '@opentelemetry/api';

//

//

export const setupBasicExpressApp = (app: express.Express) => {
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

  // Enrich span with basic request context (runs early, before authentication)
  app.use((req, res, next) => {
    const span = trace.getActiveSpan();
    if (span) {
      // Add basic HTTP context
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.route', req.path);
      span.setAttribute('http.url', req.originalUrl || req.url);
    }
    next();
  });

  // log any request
  app.use((req, res, next) => {
    log(EPriority.Info, 'REQUEST', `${req.method}: ${req.path}`, null);
    const { headers, method, params, query } = req;

    const rd = {
      method,
      json: req.body,
      query,
      headers,
      params,
    };
    log(EPriority.Info, 'REQUEST', ``, rd);
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
    ) {
      // Structured logging for observability
      error(
        'OpenAPI Request Validation',
        `Request validation failed: ${err.message}`,
        {
          validation_type: 'request',
          url: req.originalUrl,
          method: req.method,
          route: err.path,
          error_details: err.errors,
          status_code: err.status,
        }
      );

      // Add validation context to active span
      const validationSpan = trace.getActiveSpan();
      if (validationSpan) {
        validationSpan.setAttribute('validation.type', 'request');
        validationSpan.setAttribute('validation.failed', true);
        validationSpan.setAttribute(
          'validation.error_count',
          err.errors.length
        );
        validationSpan.setAttribute('http.route', err.path);

        // Add each validation error as span attributes
        err.errors.forEach((e: any, idx: number) => {
          validationSpan.setAttribute(
            `validation.error.${idx}.path`,
            e.path || 'unknown'
          );
          validationSpan.setAttribute(
            `validation.error.${idx}.message`,
            e.message || 'unknown'
          );
          validationSpan.setAttribute(
            `validation.error.${idx}.code`,
            e.errorCode || 'unknown'
          );
        });

        // Add event to span for better tracing
        validationSpan.addEvent('openapi_validation_failed', {
          'validation.type': 'request',
          'validation.error_count': err.errors.length,
          'validation.errors': JSON.stringify(err.errors),
        });
      }

      exception = new Exception(
        err.errors.map((e: any) => ({ message: e.message, public: true })),
        400
      );
    }
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
      // Log unknown error with structured logging (replaces console.log)
      error('Error', `Unknown error: ${err.message}`, {
        error_type: 'UNKNOWN_ERROR',
        error_message: err.message,
        error_stack: err.stack,
        raw_error: String(err),
      });
      exception = new UnknownException(err.message);
    }
    //
    else exception = err;

    const json = exception.toJson();

    const serialized = JSON.stringify(json, null, 4);
    // Enhanced error logging with error category
    error('Error', serialized, {
      error_uuid: exception._uuid,
      error_category: exception.errorCategory,
      error_stack: exception.stack || '',
      http_status: exception.httpStatus || 500,
    } as TJson);

    // Record exception in active span (if OpenTelemetry is initialized)
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message,
      });
    }

    const { uuid, errors } = json;

    respond(req, res, {
      type: 'json',
      json: { uuid, errors },
      status: exception.httpStatus || 500,
    });
  });
};
