import { EPriority, log } from '@holistix/log';
import {
  TJson,
  TJsonWithDate,
  TUri,
  fullUri,
  TStringMap,
} from '@holistix/shared-types';
import express from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';

type ExpressRequest = express.Request;
type ExpressResponse = express.Response;

/**
 *
 */

const headersNoCache = {
  'Cache-Control':
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
  Expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
};

const headersCORS = (origin: string | undefined) => {
  const allowedOrigins: string[] = JSON.parse(
    process.env.ALLOWED_ORIGINS || '[]'
  );
  return {
    // CORS
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Origin':
      origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  };
};

const headersJSON = {
  'Content-Type': 'application/json',
};

const headersEventStream = {
  'Content-Type': 'text/event-stream',
  Connection: 'keep-alive',
};

const headersOptions = {
  'Access-Control-Allow-Methods':
    'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
};

/**
 *
 */

type HeadersType = {
  others?: TStringMap;
  cookies?: { name: string; value: TJson; options: express.CookieOptions }[];
};

type TResponse = {
  headers?: HeadersType;
} & (
  | { type: 'json'; json: TJsonWithDate; status: number }
  | { type: 'stream'; isFirst: boolean; events: string[] }
  | { type: 'options' }
  | ({ type: 'redirect' } & TUri)
);

/**
 *
 */

export const headers = (
  req: ExpressRequest,
  res: ExpressResponse,
  r: TResponse
): void => {
  let h = {
    ...headersNoCache,
    ...headersCORS(req.headers.origin),
  };
  switch (r.type) {
    case 'json':
      h = { ...h, ...headersJSON };
      break;

    case 'options':
      h = { ...h, ...headersOptions };
      break;

    case 'stream':
      h = { ...h, ...headersEventStream };
      break;
  }
  if (r.headers?.others) h = { ...h, ...r.headers.others };
  if (r.headers?.cookies) {
    r.headers.cookies.forEach((c) => {
      res.cookie(c.name, c.value, c.options);
    });
  }
  res.set(h);
};

/**
 *
 */
export const respond = (
  req: ExpressRequest,
  res: ExpressResponse,
  r: TResponse
) => {
  if (r.type !== 'stream' || r.isFirst) headers(req, res, r);

  let logMsg = '';
  let status = 200;
  let fu = '';
  switch (r.type) {
    case 'json':
      res.status(r.status).json(r.json);
      status = r.status;
      logMsg = `${JSON.stringify(r.json)}`;
      break;

    case 'options':
      res.send('');
      break;

    case 'redirect':
      fu = fullUri(r);
      res.redirect(fu);
      status = 302;
      logMsg = fu;
      break;

    case 'stream':
      res.write(r.events.join('\n') + '\n\n');
      logMsg = r.events.join('\n');
      break;
  }

  // Update span with response status (if OpenTelemetry is initialized)
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('http.status_code', status);
    if (status >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${status}`,
      });
    }
  }

  // Enhanced response logging with structured data (trace_id/span_id automatically included by Logger)
  log(EPriority.Info, 'RESPONSE', `[${status}:${r.type}] ${logMsg}`, {
    http_status: status,
    response_type: r.type,
    response_length: logMsg.length,
  });
};
