import { EColor, log } from '@monorepo/log';
import { TJson, TJsonWithDate, TUri, fullUri } from '@monorepo/simple-types';
import express from 'express';
import { TStringMap } from '../../Request/Request';
import { jaegerSetResponse } from '../../Logs/jaeger';

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

  let color = EColor.BgGreen;
  let logMsg = '';
  let status = 200;
  let fu = '';
  switch (r.type) {
    case 'json':
      res.status(r.status).json(r.json);
      status = r.status;
      logMsg = `${JSON.stringify(r.json)}`;
      color = r.status === 200 ? EColor.BgGreen : EColor.BgMagenta;
      break;

    case 'options':
      res.send('');
      color = EColor.BgGreen;
      break;

    case 'redirect':
      fu = fullUri(r);
      res.redirect(fu);
      status = 302;
      logMsg = fu;
      color = EColor.BgCyan;
      break;

    case 'stream':
      res.write(r.events.join('\n') + '\n\n');
      logMsg = r.events.join('\n');
      color = EColor.BgGray;
      break;
  }

  jaegerSetResponse(req as any, { ...r, status });
  log(6, 'RESPONSE', `[${status}:${r.type}] ${logMsg}`, null, color);
};
