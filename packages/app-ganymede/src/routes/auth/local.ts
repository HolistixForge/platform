import express, { RequestHandler } from 'express';
import passport from 'passport';
import * as passportLocal from 'passport-local';
import { JwtPayload } from 'jsonwebtoken';

import {
  EPriority,
  log,
  Exception,
  ForbiddenException,
  UnknownException,
} from '@holistix-forge/log';
import { jwtPayload, respond } from '@holistix-forge/backend-engine';
import { TJson } from '@holistix-forge/simple-types';

import { verifyPassword } from '../../models/users';
import {
  passwordChange,
  getUserSessionDetails,
  signup,
  userNeedTotpAuthentication,
} from '../../models/users';
import { Req, UserSerializedInfo } from '../../types';

//

// set the 'verify' function used by the "local strategie" called in /login POST route
passport.use(
  new passportLocal.Strategy(
    { usernameField: 'email' },
    async (username, password, cb) => {
      try {
        const user = await verifyPassword(username, password);
        if (user) cb(null, user);
        else
          return cb(null, false, { message: 'Invalid username or password' });
      } catch (error) {
        return cb(error);
      }
    }
  )
);

//
//

export const setupLocalRoutes = (
  router: express.Router,
  rateLimiter?: RequestHandler
) => {
  // Apply rate limiter to sensitive endpoints
  const handlers = rateLimiter ? [rateLimiter] : [];

  router.post(
    '/signup',
    ...handlers,
    async function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      let user_id = '';
      try {
        const { email, password, username, firstname, lastname } = req.body;
        log(
          EPriority.Info,
          'SIGNUP',
          `/signup: ${JSON.stringify({ email, username })}`
        );
        user_id = await signup({
          email,
          password,
          username,
          firstname,
          lastname,
        });
      } catch (error) {
        return next(error);
      }

      const user = {
        id: user_id,
        username: req.body.username,
      };

      // set User object in session
      req.login(user, function (err) {
        if (err) {
          return next(err);
        }
        respond(req, res, {
          type: 'json',
          json: {},
          status: 200,
        });
      });
    }
  );

  //
  //

  router.post(
    '/login',
    ...handlers,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'local',
        { failureMessage: true },
        function (
          err: Error | null,
          user: UserSerializedInfo | false | undefined,
          info: { message: string } | undefined,
          status: number | undefined
        ) {
          if (err) {
            return next(err);
          } else if (!user) {
            const e = new Exception(
              [
                {
                  message: info?.message || 'Invalid credentials',
                  public: true,
                },
              ],
              401
            );
            return next(e);
          } else {
            req.login(user, function (err) {
              if (err) {
                return next(err);
              }
              respond(req, res, {
                type: 'json',
                json: {},
                status: 200,
              });
            });
          }
        }
      )(req, res, next);
    }
  );

  //
  //

  router.post(
    '/logout',
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      // remove User object in session
      req.logout(function (err) {
        if (err) {
          return next(err);
        }
        respond(req, res, {
          type: 'json',
          json: {},
          status: 200,
        });
      });
    }
  );

  //
  //

  router.post(
    '/me',
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      try {
        const user = await getUserSessionDetails((req as Req).sessionID);
        respond(req, res, {
          type: 'json',
          json: user ? { user } : { user: { user_id: null } },
          status: 200,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  //
  //

  router.get(
    '/user',
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      let user: TJson = { user_id: null };

      try {
        if (req.headers.authorization) {
          let token = req.headers.authorization;
          if (token.startsWith('Bearer ')) token = token.replace('Bearer ', '');
          const payload = jwtPayload(token) as JwtPayload;
          console.log(payload);
          user = payload.user;
        }

        respond(req, res, {
          type: 'json',
          json: user,
          status: 200,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  //
  //

  router.post(
    '/password',
    ...handlers,
    async function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      const d = await getUserSessionDetails((req as Req).sessionID);
      if (!d) {
        next(new UnknownException('session not found'));
      } else {
        if (userNeedTotpAuthentication(d, 10))
          return next(
            new ForbiddenException([{ message: 'TOTP login required' }])
          );

        if (d.user_type !== 'local')
          return next(
            new ForbiddenException([
              { message: 'no password for this account' },
            ])
          );

        const { password } = req.body;
        await passwordChange(d.user_id, password);
        log(EPriority.Info, 'PASSWORD', `new password for [${d.user_id}]`);
        respond(req, res, {
          type: 'json',
          json: {},
          status: 200,
        });
      }
    }
  );
};
