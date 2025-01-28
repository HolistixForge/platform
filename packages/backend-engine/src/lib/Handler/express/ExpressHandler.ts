import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

import { error, log } from '@monorepo/log';

import { Handler } from '../Handler';
import { Executor } from '../../Executor/Executor';
import { ApiDefinition } from '../../ApiDefinition/ApiDefinition';
import { Request, TRequestData } from '../../Request/Request';
import { Response } from '../../Response/Response';
import { OpenApiValidatorOpts } from 'express-openapi-validator/dist/framework/types';
import { respond } from './responses';
import { setupValidator } from './openapi-validator';
import { NotFoundException } from '../../Exceptions/Exception';
import {
  BasicExpressAppOptions,
  setupBasicExpressApp,
  setupErrorsHandler,
} from './app-setup';

type ExpressRequest = express.Request;
type ExpressResponse = express.Response;

//
//
//
//

type TMatch = {
  path: TRequestData['path'];
  pathParameters: TRequestData['pathParameters'];
};

export type TStart = {
  port: number;
  host: string;
  certificate?: {
    certFile: string;
    keyfile: string;
  };
};

//
//

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

//
//

export class ExpressHandler extends Handler {
  _app: express.Express;

  constructor(
    e: Executor,
    d: ApiDefinition,
    options?: {
      openApiValidator?: OpenApiValidatorOpts;
      basicExpressApp?: BasicExpressAppOptions;
    }
  ) {
    super(e, d);

    this._app = express();
    setupBasicExpressApp(this._app, options?.basicExpressApp);

    this._app.options('*', (req, res) => {
      respond(req, res, {
        type: 'options',
      });
    });

    if (options) setupValidator(this._app, options?.openApiValidator);

    this._app.get('*', async (req, res, next) => {
      await this._processRequest(req, res, next);
    });

    this._app.post('*', async (req, res, next) => {
      await this._processRequest(req, res, next);
    });

    this._app.patch('*', async (req, res, next) => {
      await this._processRequest(req, res, next);
    });

    this._app.put('*', async (req, res, next) => {
      await this._processRequest(req, res, next);
    });

    this._app.delete('*', async (req, res, next) => {
      await this._processRequest(req, res, next);
    });

    setupErrorsHandler(this._app);
  }

  //
  //

  _processRequest = async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: express.NextFunction
  ) => {
    // url, baseUrl, originalUrl,
    const { headers, method, params, query } = req;

    const rd: TRequestData = {
      httpMethod: method as TRequestData['httpMethod'],
      json: req.body,
      getParameters: query as TRequestData['getParameters'],
      headers: headers as TRequestData['headers'],
      ...this._matchResource(params[0]),
    };
    const r = new Request(rd);

    req.on('close', () => {
      // res.end();
      r.stop = true;
    });

    let count = 0;
    do {
      try {
        await this._executor.doRequest(r);
        this._response(req, res, r.response, r.isEventSource, count);
        count++;
      } catch (err) {
        r.stop = true;
        next(err);
      }
    } while (r.isEventSource && !r.stop && (await delay(2000)));
  };

  //
  //

  _response = (
    req: ExpressRequest,
    res: ExpressResponse,
    response: Response,
    isEventSource: boolean,
    count: number
  ) => {
    const cookies = response._cookies.map((c) => {
      const options = {
        ...c.options,
        expires: c.options.expires ? new Date(c.options.expires) : undefined,
        // secure, httpOnly and sameSite: altogether allow to send cookie
        // from a frontend with a different domain name
        secure: true,
        httpOnly: true,
        sameSite: 'none' as const,
      };
      return { name: c.name, value: c.value, options };
    });

    const headers = { others: response.headers, cookies };

    if (isEventSource) {
      /// response for an event source endpoint
      respond(req, res, {
        type: 'stream',
        isFirst: count === 0,
        events: response.serverSentEvents,
        headers,
      });
      response.clearServerSentEvents();
      //
    } else if (response._redirection) {
      respond(req, res, {
        type: 'redirect',
        ...response._redirection,
        headers,
      });
    } else {
      respond(req, res, {
        type: 'json',
        status: response.statusCode,
        json: response.bodyObject(),
        headers,
      });
    }
  };

  //
  //

  static start(
    app: express.Express,
    config: TStart
  ): https.Server | http.Server {
    const { host, port, certificate } = config;
    const url = `${certificate ? 'https' : 'http'}://${host}:${port}`;

    const server = certificate
      ? https.createServer(
          {
            key: fs.readFileSync(certificate.keyfile),
            cert: fs.readFileSync(certificate.certFile),
          },
          app
        )
      : http.createServer({}, app);

    server.listen(port, host, undefined, function () {
      log(6, '', `Express server listening [${url}]`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.on('error', (...args: any[]) => {
      error('', `express server error`, args);
    });

    return server;
  }

  start(config: TStart): https.Server | http.Server {
    return ExpressHandler.start(this._app, config);
  }

  //
  //

  _matchResource = (reqPath: string): TMatch => {
    let path = null;
    let pathParameters = {};

    for (const p in this._apiDefinition.paths) {
      const regexToken = p.split('/').map((t) => {
        const groupname = t.replace(/[{}]/g, '');
        if (t.charAt(0) === '{') return `(?<${groupname}>[^/]+)`;
        else return t;
      });

      const acceptAnySubpath = (this._apiDefinition.paths[p] as any)[
        'x-all-subpaths'
      ];
      const allSubpathGroup = acceptAnySubpath ? '(?<subpath>.*)' : '';

      const regex = `^${regexToken.join('/')}${allSubpathGroup}[/]?$`;

      const matchs = reqPath.match(regex);
      if (matchs) {
        path = p;
        pathParameters = { ...matchs.groups };
        break;
      }
    }

    if (!path) throw new NotFoundException();

    return { path, pathParameters };
  };
}
