import express from 'express';
import passport from 'passport';
import * as passportGithub from 'passport-github2';
import { respond } from '@holistix-forge/backend-engine';
import { Exception } from '@holistix-forge/log';

import { githubFindOrCreate, TGithubReturnedProfile } from '../../models/users';
import { UserSerializedInfo } from '../../types';
import { CONFIG } from '../../config';

//
//

const CALLBACK_PATH = '/github/callback';

passport.use(
  new passportGithub.Strategy(
    {
      clientID: CONFIG.GITHUB_CLIENT_ID,
      clientSecret: CONFIG.GITHUB_CLIENT_SECRET,
      callbackURL: `${CONFIG.APP_GANYMEDE_URL}${CALLBACK_PATH}`,
    },
    async function (
      accessToken: string,
      refreshToken: string,
      profile: TGithubReturnedProfile,
      cb: (e: null | Error, u?: UserSerializedInfo) => void
    ) {
      try {
        const user: UserSerializedInfo | null = await githubFindOrCreate(
          profile,
          accessToken
        );
        return cb(null, user);
      } catch (error: any) {
        return cb(error);
      }
    }
  )
);

//
//

export const setupGithubRoutes = (router: express.Router) => {
  router.get(
    '/github',
    passport.authenticate('github', { scope: ['user:email'] })
  );

  // GET /auth/github/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function will be called,
  //   which, in this example, will redirect the user to the home page.
  router.get(
    CALLBACK_PATH,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'github',
        {
          /* failureRedirect: '/login' */
        },
        (err: Error | null, user: UserSerializedInfo) =>
          OAuthCallback(req, res, next, err, user)
      )(req, res, next);
    }
  );
};

//
//
//

export const OAuthCallback = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  err: Error | null,
  user: UserSerializedInfo
) => {
  if (err) {
    return next(err);
  } else if (!user) {
    const e = new Exception(
      [{ message: 'Please try again later', public: true }],
      500
    );
    return next(e);
  } else {
    req.login(user, function (err) {
      if (err) {
        return next(err); /* TODO_AUTH_AGAIN: redirect error page */
      }
      respond(req, res, {
        type: 'redirect',
        url: CONFIG.APP_FRONTEND_URL,
      });
    });
  }
};
