import express from 'express';
import OAuth2Server, {
  AuthorizeOptions,
  TokenOptions,
  Request,
  Response,
  AuthorizationCode,
} from '@node-oauth/oauth2-server';

import { respond } from '@holistix/backend-engine';
import { ForbiddenException } from '@holistix/log';

import { authenticateHandler, model } from '../../models/oauth';
import { userIsAuthenticated } from '../../models/users';
import { Req } from '../../types';
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

export const setupOauthRoutes = (router: express.Router) => {
  //

  async function handleAuthorize(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const queryParameters = {
      redirect: `${CONFIG.APP_GANYMEDE_URL}${req.path}`,
      client_id: req.query.client_id as string,
      redirect_uri: req.query.redirect_uri as string,
    };
    // Redirect anonymous users to login page. propagating client id and redirect_uri
    if (!(await userIsAuthenticated(req as Req))) {
      if (req.method === 'GET')
        respond(req, res, {
          type: 'redirect',
          url: CONFIG.LOGIN_PAGE_URL,
          queryParameters,
        });
      else
        respond(req, res, {
          type: 'json',
          status: 401,
          json: { location: CONFIG.LOGIN_PAGE_URL, ...queryParameters },
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
        return next(new ForbiddenException([], err));
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
  // https://account-local.demiurge.co/oauth/authorize?client_id=ganymede&redirect_uri=https%3A%2F%2Flocal.demiurge.co&state=caca&response_type=code&scope=email
  // https://account-local.demiurge.co/oauth/authorize?client_id=ganymede&redirect_uri=https%3A%2F%2Fcaca.demyurge.com&state=caca&response_type=code&scope=email
  router.get('/oauth/authorize', handleAuthorize);
  router.post('/oauth/authorize', handleAuthorize);

  //

  // code: curl -X POST http://localhost:8080/oauth/token -H 'Content-Type: application/x-www-form-urlencoded' -d 'grant_type=authorization_code' -d 'client_id=ganymede' -d 'client_secret=ganymede' -d 'code=code_76d93cfb-1031-4e88-a8a0-f4c5bccdb074' -d 'redirect_uri=https://local.demiurge.co' | json_pp
  // refresh: curl -X POST http://localhost:8080/oauth/token -H 'Content-Type: application/x-www-form-urlencoded' -d 'grant_type=refresh_token' -d 'client_id=ganymede' -d 'client_secret=ganymede' -d 'refresh_token=refresh_token_49e6abbc-8926-49a9-935d-bbc4d4873aa1' | json_pp
  router.post(
    '/oauth/token',
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
