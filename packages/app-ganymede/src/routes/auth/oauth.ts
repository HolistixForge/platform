import express, { RequestHandler } from 'express';
import OAuth2Server, {
  AuthorizeOptions,
  TokenOptions,
  Request,
  Response,
  AuthorizationCode,
} from '@node-oauth/oauth2-server';

import { respond } from '@holistix-forge/backend-engine';
import { ForbiddenException } from '@holistix-forge/log';

import { authenticateHandler, model } from '../../models/oauth';
import { userIsAuthenticated } from '../../models/users';
import { Req } from '../../types';
import { frontendUrlFor, ganymedeUrlFor } from '../../lib/public-routing';
import { CONFIG } from '../../config';

//
//
//

const server = new OAuth2Server({
  model: model,
  accessTokenLifetime: 3600,
  refreshTokenLifetime: 1209600,
  authenticateHandler: authenticateHandler,
});

const authorizeOptions: AuthorizeOptions = {
  allowEmptyState: false,
  authorizationCodeLifetime: 5 * 60, // secondes
};

const tokenOptions: TokenOptions = {
  accessTokenLifetime: 3600,
  refreshTokenLifetime: 1209600,
  allowExtendedTokenAttributes: false,
  requireClientAuthentication: {},
  alwaysIssueNewRefreshToken: true,
  extendedGrantTypes: {}, // { [key: string]: typeof AbstractGrantType } | undefined;
};

//
//
//

export const setupOauthRoutes = (
  router: express.Router,
  rateLimiter?: RequestHandler
) => {
  // Apply rate limiter to token endpoint (most sensitive)
  const tokenHandlers = rateLimiter ? [rateLimiter] : [];

  //

  async function handleAuthorize(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    // Both of these are links a browser is about to follow, so they have to
    // point at the host that browser is on. On the configured domain these are
    // exactly CONFIG.APP_GANYMEDE_URL and CONFIG.LOGIN_PAGE_URL; through a
    // tunnel they follow the request, which is what keeps a sign-in from
    // bouncing the visitor onto a name their machine cannot resolve.
    const loginPageUrl = `${frontendUrlFor(req)}/account/login`;
    const queryParameters = {
      redirect: `${ganymedeUrlFor(req)}${req.path}`,
      client_id: req.query.client_id as string,
      redirect_uri: req.query.redirect_uri as string,
    };
    // Redirect anonymous users to login page. propagating client id and redirect_uri
    const isAuthenticated = await userIsAuthenticated(req as Req);

    if (!isAuthenticated) {
      if (req.method === 'GET')
        respond(req, res, {
          type: 'redirect',
          url: loginPageUrl,
          queryParameters,
        });
      else
        respond(req, res, {
          type: 'json',
          status: 401,
          json: { location: loginPageUrl, ...queryParameters },
        });
    } else {
      const request = new Request(req);
      const response = new Response(res);
      let code: AuthorizationCode;
      try {
        code = await server.authorize(request, response, authorizeOptions);
        /**
         * getClient
         * authenticateHandler.handle
         * generateAuthorizationCode
         * saveAuthorizationCode
         */
      } catch (err: any) {
        return next(
          new ForbiddenException(
            [{ message: err.message || 'Authorization failed', public: false }],
            err
          )
        );
      }

      const r = {
        code: code.authorizationCode,
        state: req.query.state as string,
      };

      if (req.method === 'GET')
        respond(req, res, {
          type: 'redirect',
          url: code.redirectUri,
          queryParameters: r,
        });
      else respond(req, res, { type: 'json', status: 200, json: r });
    }
  }

  // Get authorization.
  router.get('/oauth/authorize', handleAuthorize);
  router.post('/oauth/authorize', handleAuthorize);

  //

  router.post(
    '/oauth/token',
    ...tokenHandlers,
    async function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      const authHeader = req.headers['authorization'];

      if (authHeader && authHeader.startsWith('Basic ')) {
        // Extract the base64 encoded part
        const base64Credentials = authHeader.split(' ')[1];

        // Decode the base64 string into client_id:client_secret
        const decodedCredentials = Buffer.from(
          base64Credentials,
          'base64'
        ).toString('utf8');

        // Split the decoded string to get client_id and client_secret
        const [client_id, client_secret] = decodedCredentials.split(':');

        // Attach the credentials to the request object for further use
        req.body.client_id = client_id;
        req.body.client_secret = client_secret;
      }

      const request = new Request(req);
      const response = new Response(res);
      try {
        await server.token(request, response, tokenOptions as any);
      } catch (err: any) {
        return next(new ForbiddenException([], err));
      }
      /**
       * CODE:
       * getClient
       * getAuthorizationCode
       * revokeAuthorizationCode
       * validateScope
       * generateAccessToken
       * generateRefreshToken
       * saveToken
       *
       * REFRESH:
       * getClient
       * getRefreshToken
       * revokeToken
       * generateAccessToken
       * generateRefreshToken
       * saveToken
       */
      respond(req, res, {
        type: 'json',
        json: response.body,
        status: 200,
      });
    }
  );

  //

  router.get(
    '/oauth/public-key',
    async function (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) {
      respond(req, res, {
        type: 'json',
        json: { publicKey: CONFIG.JWT_PUBLIC_KEY },
        status: 200,
      });
    }
  );
};
