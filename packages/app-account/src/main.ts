import './declarations.d.ts';
import express, { Request } from 'express';
import expressSession from 'express-session';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import passport from 'passport';

import {
  ExpressHandler,
  TStart,
  respond,
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
} from '@monorepo/backend-engine';
import { NotFoundException } from '@monorepo/log';

import { PgSessionModel } from './models/session';
import { setupGithubRoutes } from './github';
import { setupLocalRoutes } from './local';
import { setupGitlabRoutes } from './gitlab';
import { setupTOTPRoutes } from './totp';
import { setupMagicLinkRoutes } from './magic-link';
import { setupOauthRoutes } from './oauth';
import { setupLinkedinRoutes } from './linkedin';
import { setupDiscordRoutes } from './discord';

//

import { CONFIG } from './config';

import oas from './oas30.json';

/*
 *
 */

export type UserSerializedInfo = { id: string; username: string };

type LoginLogoutCallback = (err: Error) => void;

export type Req = Request & {
  login: (user: UserSerializedInfo, cb: LoginLogoutCallback) => void;
  logout: (cb?: LoginLogoutCallback) => void;
  session: {
    passport?: { user?: UserSerializedInfo };
    secondFactor?: 'totp';
  };
  sessionID: string;
};

/*
 *
 * Express Basic setup
 *
 */

const app = express();
app.set('trust proxy', 1);

setupBasicExpressApp(app, {
  jaeger: process.env.JAEGER_FQDN
    ? {
        serviceName: 'demiurge',
        serviceTag: 'account',
        host: process.env.JAEGER_FQDN,
      }
    : undefined,
});

app.options('*', (req, res) => {
  respond(req, res, {
    type: 'options',
  });
});

setupValidator(app, { apiSpec: oas as OpenAPIV3.DocumentV3 });

/**
 * express session config
 */

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // (30 days) uSec

app.use(
  expressSession({
    store: new PgSessionModel(),
    secret: CONFIG.SESSION_COOKIE_KEY,
    resave: false,
    saveUninitialized: false,
    name: 'sessid',
    cookie: {
      secure: true,
      domain: CONFIG.ACCOUNT_FQDN,
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    },
  })
);

// passport setup
app.use(passport.initialize());
app.use(passport.session());

// routes
export const router = express.Router();
setupGithubRoutes(router);
setupGitlabRoutes(router);
setupLinkedinRoutes(router);
setupDiscordRoutes(router);
setupLocalRoutes(router);
setupTOTPRoutes(router);
setupMagicLinkRoutes(router);
setupOauthRoutes(router);
app.use('/', router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err: any = new NotFoundException();
  next(err);
});

// error handlers
setupErrorsHandler(app);

//

const bindings: TStart[] = JSON.parse(CONFIG.ACCOUNT_SERVER_BIND);
bindings.forEach((b) => {
  ExpressHandler.start(app, b);
});
