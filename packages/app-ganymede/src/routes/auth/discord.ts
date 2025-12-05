import express from 'express';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { discordFindOrCreate, TDiscordReturnedProfile } from '../../models/users';
import { UserSerializedInfo } from '../../types';
import { CONFIG } from '../../config';
import { OAuthCallback } from './github';

const CALLBACK_PATH = '/discord/callback';

passport.use(
  new DiscordStrategy(
    {
      clientID: CONFIG.DISCORD_CLIENT_ID,
      clientSecret: CONFIG.DISCORD_CLIENT_SECRET,
      callbackURL: `${CONFIG.APP_GANYMEDE_URL}${CALLBACK_PATH}`,
      scope: ['identify', 'email'],
    },
    async function (
      accessToken: string,
      refreshToken: string,
      profile: TDiscordReturnedProfile,
      cb: (e: null | Error, u?: UserSerializedInfo) => void
    ) {
      try {
        const user: UserSerializedInfo | null = await discordFindOrCreate(
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

export const setupDiscordRoutes = (router: express.Router) => {
  router.get('/discord', passport.authenticate('discord'));

  router.get(
    CALLBACK_PATH,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'discord',
        {},
        (err: Error | null, user: UserSerializedInfo) =>
          OAuthCallback(req, res, next, err, user)
      )(req, res, next);
    }
  );
};
