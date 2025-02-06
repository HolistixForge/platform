import express from 'express';
import passport from 'passport';
import * as passportGitlab from 'passport-gitlab2';
import { UserSerializedInfo } from './main';
import { OAuthCallback } from './github';
import { gitlabFindOrCreate, TGitlabReturnedProfile } from './models/users';
import { CONFIG } from './config';

//
//

const CALLBACK_PATH = '/gitlab/callback';

passport.use(
  new passportGitlab.Strategy(
    {
      clientID: CONFIG.GITLAB_CLIENT_ID,
      clientSecret: CONFIG.GITLAB_CLIENT_SECRET,
      callbackURL: `${CONFIG.APP_ACCOUNT_URL}${CALLBACK_PATH}`,
    },
    async function (
      accessToken: string,
      refreshToken: string,
      profile: TGitlabReturnedProfile,
      cb: (e: null | Error, u?: UserSerializedInfo) => void
    ) {
      try {
        const user: UserSerializedInfo | null = await gitlabFindOrCreate(
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

export const setupGitlabRoutes = (router: express.Router) => {
  router.get(
    '/gitlab',
    passport.authenticate('gitlab', { scope: ['read_user'] })
  );

  router.get(
    CALLBACK_PATH,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'gitlab',
        {
          /* failureRedirect: '/login' */
        },
        (err: Error | null, user: UserSerializedInfo) =>
          OAuthCallback(req, res, next, err, user)
      )(req, res, next);
    }
  );
};
