import express from 'express';
import passport from 'passport';
const LinkedInStrategy = require('../../lib/passport-linkedin-oauth2-v3');
import { linkedinFindOrCreate, TLinkedinReturnedProfile } from '../../models/users';
import { UserSerializedInfo } from '../../types';
import { CONFIG } from '../../config';
import { OAuthCallback } from './github';

const CALLBACK_PATH = '/linkedin/callback';

const s = new LinkedInStrategy(
  {
    clientID: CONFIG.LINKEDIN_CLIENT_ID,
    clientSecret: CONFIG.LINKEDIN_CLIENT_SECRET,
    callbackURL: `${CONFIG.APP_GANYMEDE_URL}${CALLBACK_PATH}`,
    scope: ['email', 'profile', 'openid'],
    state: true,
  } as any,
  async function (
    accessToken: string,
    refreshToken: string,
    profile: TLinkedinReturnedProfile,
    cb: (e: null | Error, u?: UserSerializedInfo) => void
  ) {
    try {
      const user: UserSerializedInfo | null = await linkedinFindOrCreate(
        profile,
        accessToken
      );
      return cb(null, user);
    } catch (error: any) {
      return cb(error);
    }
  }
);

passport.use(s);

export const setupLinkedinRoutes = (router: express.Router) => {
  router.get('/linkedin', passport.authenticate('linkedin'));

  router.get(
    CALLBACK_PATH,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'linkedin',
        {},
        (err: Error | null, user: UserSerializedInfo) =>
          OAuthCallback(req, res, next, err, user)
      )(req, res, next);
    }
  );
};
