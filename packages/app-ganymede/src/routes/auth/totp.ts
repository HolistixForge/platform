import express from 'express';
import passport from 'passport';
import crypto from 'crypto';
import base32 from 'thirty-two';

import { respond } from '@holistix-forge/backend-engine';
import { EPriority, log, Exception, ForbiddenException } from '@holistix-forge/log';
import { TJsonWithDate } from '@holistix-forge/simple-types';

import { Req } from '../../types';
import { findKeyForUserId, totpSaveKey, totpSuccess } from '../../models/users';
import { UserSerializedInfo } from '../../types';
import PassportTotpStrategy from '../../lib/passport-totp.js';

//

export const TOTP_PERIOD = 30;

type SerializeCallback = (err: Error | null, u?: UserSerializedInfo) => void;

//

passport.use(
  new PassportTotpStrategy(async function (
    user: UserSerializedInfo,
    done: (e: Error | null, k?: string, p?: number) => void
  ) {
    try {
      const k = await findKeyForUserId(user.id);
      if (!k) return done(new Error('2FA with TOTP has not been setup yet'));
      return done(null, k.key, TOTP_PERIOD);
    } catch (error: any) {
      return done(error);
    }
  })
);

/* Configure session management.
 *
 * When a login session is established, information about the user will be
 * stored in the session.  This information is supplied by the `serializeUser`
 * function, which is yielding the user ID and username.
 *
 * As the user interacts with the app, subsequent requests will be authenticated
 * by verifying the session. The same user information that was serialized at
 * session establishment will be restored when the session is authenticated by
 * the `deserializeUser` function.
 */
passport.serializeUser(function (
  user: Express.User, // UserSerializedInfo,
  cb: SerializeCallback
) {
  process.nextTick(function () {
    log(
      EPriority.Debug,
      'SESSION_STORE',
      `serialize user [${(user as UserSerializedInfo).username}]`
    );
    cb(null, { ...(user as UserSerializedInfo) });
  });
});

passport.deserializeUser(function (
  user: UserSerializedInfo,
  cb: SerializeCallback
) {
  process.nextTick(function () {
    log(
      EPriority.Debug,
      'SESSION_STORE',
      `deserialize user [${user.username}]`
    );
    return cb(null, user);
  });
});

//
//
//

export const userFromSession = (req: Req): UserSerializedInfo | undefined => {
  return req.session.passport?.user;
};

//

const TOTP_KEY_LEN = 50;

//

export const setupTOTPRoutes = (router: express.Router) => {
  router.post(
    '/totp/setup',
    async function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      const ili = userFromSession(req as Req);
      if (!ili)
        return next(new ForbiddenException([{ message: 'not loggged in' }]));

      const { id, username } = ili;

      let existingKey = await findKeyForUserId(id);
      if (!existingKey) {
        const newKey = generateRandomString(TOTP_KEY_LEN);
        try {
          totpSaveKey(id, newKey);
          existingKey = { key: newKey, validated: false };
        } catch (error) {
          next(error);
          return;
        }
      }

      let key: string | undefined = undefined;
      let otpUrl: string | undefined = undefined;

      if (!existingKey.validated) {
        key = existingKey.key;
        const encodedKey = base32.encode(existingKey.key);
        // generate QR code for scanning into Google Authenticator, etc
        otpUrl = `otpauth://totp/demiurge:${username}?secret=${encodedKey}&period=${TOTP_PERIOD}`;
      }

      respond(req, res, {
        type: 'json',
        json: {
          otpUrl,
          key,
        } as TJsonWithDate,
        status: 200,
      });
    }
  );

  //

  router.post(
    '/totp/login',
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'totp',
        {},
        function (
          err: Error | null,
          user: UserSerializedInfo | false | undefined,
          info: { message: string } | undefined,
          status: number | undefined
        ) {
          if (err) {
            return next(err);
          } else if (!user) {
            const e = new Exception([], status || 403);
            return next(e);
          } else {
            (req as Req).session.secondFactor = 'totp';
            totpSuccess(req.sessionID, user.id);
            respond(req, res, {
              type: 'json',
              json: {},
              status: 200,
            });
          }
        }
      )(req, res, next);
    }
  );
};

//
//

/**
 * generate a hex string of (2 x length) caracter
 * @param length
 * @returns
 */
const generateRandomString = (length: number) => {
  return crypto.randomBytes(length).toString('hex');
};
