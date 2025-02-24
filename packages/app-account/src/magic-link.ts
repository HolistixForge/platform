/* eslint-disable @typescript-eslint/no-unused-vars */
import express from 'express';
import passport from 'passport';
import { respond } from '@monorepo/backend-engine';
import { Req, UserSerializedInfo } from './main';
import { setEmailValidated, passwordFlagReset } from './models/users';
import * as passportMagicLink from 'passport-magic-link';
import { log } from '@monorepo/log';
import { sendMail } from './send-mail';
import { MagicLinkModel } from './models/magic-link';
import { userGetLocalByEmail } from './models/users';
import { CONFIG } from './config';
import { makeUuid } from '@monorepo/simple-types';

const CALLBACK_PATH = '/magiclink/callback';

export type MagicLinkUser = UserSerializedInfo & {
  magicLinkUuid: string;
  email: string;
  context: 'reset-password' | 'validate-email';
};

//
//

passport.use(
  new passportMagicLink.Strategy(
    {
      secret: CONFIG.MAGILINK_SECRET,
      /** An array of mandatory field names from the request query
       * or body that are going to be used to create or retrieve the user. */
      userFields: ['email'],
      /** The name of the field which contains the token in the request query or body */
      tokenField: 'token',
      // ttl: Optional integer, defaults to 10 minutes (in seconds). It's used to set the token expiration
      passReqToCallbacks: true, // Optional boolean, defaults to false. If true, the request is passed to the sendToken and verifyUser functions.
      // verifyUserAfterToken: Optional boolean, defaults to false. If true, the request data is passed to the token and the user is verified after the token confirmation.
      storage: new MagicLinkModel(),
    },
    /**
     * sendToken:
     * A function that is used to deliver the token to the user.
     * You may use an email service, SMS or whatever method you want.
     * It receives the user object, the token and optionally the request.
     * It returns a promise indicating whether the token has been sent or not.
     */
    async (req: Req, user: MagicLinkUser, token: string) => {
      log(6, 'ACCOUNT', `Send email to user ${user.email}`);
      const sent = await sendMail({
        from: 'noreply@demiurge.co',
        to: user.email,
        subject: 'Demiurge login link',
        html: mailContent(user, token),
      });
      return sent;
    },
    /**
     * verifyUser:
     * A function that receives the request and returns a promise containing the user object.
     * It may be used to insert and/or find the user in the database.
     * It may be executed before the token creation or after the token confirmation.
     */
    (req: Req, user: { email: string }): Promise<MagicLinkUser | null> => {
      return userGetLocalByEmail(user.email).then((u) => {
        if (u) {
          const r: MagicLinkUser = {
            ...u,
            magicLinkUuid: `${makeUuid()}`,
            email: user.email,
            context: req.body.context,
          };
          return r;
        } else return null;
      });
    }
  )
);

//
//

const mailContent = (user: MagicLinkUser, token: string) => {
  return `
  <p>Dear ${user.username}</p>
  <p>We have received a request to perform the following Demiurge user account operation</p>
  <p><b>${
    user.context === 'reset-password'
      ? 'Reset your password'
      : user.context === 'validate-email'
      ? 'Validate your email address'
      : ''
  }</b></p>
  <p><b>If you did NOT request this operation, do NOT click on the link</b></p>
  <p>This link expires 10 minutes after your original verification request</p>
  <p><a href="https://${
    CONFIG.APP_ACCOUNT_URL
  }/magiclink/callback?token=${token}">Validate operation</a></p>
  `;
};

//
//

export const setupMagicLinkRoutes = (router: express.Router) => {
  /**
   * request token:
   * In this situation the passport authenticate middleware will send a token produced
   * by the user information, which is returned by the verifyUser function.
   * The delivery system is not provided by default and must be placed in the sendToken function.
   */

  router.post(
    '/magiclink/request',
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'magiclink',
        {
          action: 'requestToken',
          userPrimaryKey: 'magicLinkUuid',
        } as passport.AuthenticateOptions,
        /**
         *  function called on error
         */
        function (
          err: Error | null,
          user: UserSerializedInfo | false | undefined,
          info: { message: string } | undefined,
          status: number | undefined
        ) {
          // whatever happen we return OK so it is not possible to test
          // if user account exist or not
          respond(req, res, {
            type: 'json',
            json: {},
            status: 200,
          });
        }
      )(req, res, next);
    },
    /**
     *  function called on success (user exists, mail sent)
     */
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      respond(req, res, {
        type: 'json',
        json: {},
        status: 200,
      });
    }
  );

  /**
   * accept token:
   * In this situation (the default) the passport authenticate middleware will check for a token.
   * The token value is returned by the verifyToken function.
   * The options field can also receive some optional properties:
   *     allowReuse: A boolean indicating whether a token can be used more than once. Defaults to false.
   *     userPrimaryKey: A string containing the primary key of the user object. This is only used if the token cannot be reused. Defaults to email.
   *     tokenAlreadyUsedMessage: A string containing the error message if the token has already been used. Defaults to 'Token was already used'.
   */

  router.get(
    CALLBACK_PATH,
    function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      passport.authenticate(
        'magiclink',
        {
          action: 'acceptToken',
          userPrimaryKey: 'magicLinkUuid',
        } as passport.AuthenticateOptions,
        async function (
          err: Error | null,
          user: MagicLinkUser | false | undefined,
          info: { message: string } | undefined,
          status: number | undefined
        ) {
          if (err) {
            return next(err);
          }

          // 'Token missing
          // 'jwt expired'
          // 'Token was already used'
          else if (info) {
            respond(req, res, {
              type: 'redirect',
              url: CONFIG.MAGIC_LINK_FAILED_URL,
              queryParameters: {
                message: info.message,
              },
            });
          }

          //
          else if (user) {
            await setEmailValidated(user.id);
            if (user.context === 'reset-password') {
              await passwordFlagReset(user.id);
            }

            req.login(user, function (err) {
              if (err) {
                return next(err);
              }

              respond(req, res, {
                type: 'redirect',
                url: CONFIG.APP_FRONTEND_URL,
                queryParameters: {
                  context: user.context,
                },
              });
            });
          }
        }
      )(req, res, next);
    }
  );
};
