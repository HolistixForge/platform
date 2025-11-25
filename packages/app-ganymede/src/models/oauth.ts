import {
  AuthorizationCodeModel,
  RefreshTokenModel,
  Client,
  AuthorizationCode,
  Falsey,
  Token,
  RefreshToken,
  Request,
  Response,
} from '@node-oauth/oauth2-server';

import { error, log } from '@monorepo/log';
import { makeUuid } from '@monorepo/simple-types';
import { development, generateJwtToken } from '@monorepo/backend-engine';
import { GLOBAL_CLIENT_ID, TJwtUser } from '@monorepo/demiurge-types';

import { CONFIG } from '../config';
import { pg } from '../database/pg';
import { userFromSession } from '../routes/auth/totp';
import { Req, UserSerializedInfo } from '../types';

//

const ACCESS_TOKEN_LIFETIME = development(() => 600) || 3600;

const REFRESH_TOKEN_LIFETIME = 3600 * 24 * 7;

type OauthModelUser = UserSerializedInfo & {
  session_id: string;
  validated_scope?: string[];
};

//

const debug = (msg: string, o: any) => {
  log(7, 'OAUTH_MODEL', msg, o);
};

//

export const model: AuthorizationCodeModel &
  RefreshTokenModel & { verifyScope: AuthorizationCodeModel['verifyScope'] } = {
  //

  getClient: async (
    clientId: string,
    clientSecret: string
  ): Promise<Client | Falsey> => {
    // TODO: OAuth moved to gateway - this is now a stub
    // This is only used for the global 'demiurge-global' client
    if (clientId === GLOBAL_CLIENT_ID) {
      return {
        id: GLOBAL_CLIENT_ID,
        grants: ['authorization_code', 'refresh_token'],
        redirectUris: [CONFIG.APP_FRONTEND_URL, CONFIG.APP_FRONTEND_URL_DEV],
        accessTokenLifetime: ACCESS_TOKEN_LIFETIME,
        refreshTokenLifetime: REFRESH_TOKEN_LIFETIME,
      };
    }

    debug(`getClient`, { args: { clientId, clientSecret }, r: false });
    return false;
  },

  //

  generateAccessToken: (
    client: Client,
    user: OauthModelUser,
    scope: string[]
  ): Promise<string> => {
    const payload = makeJwtUserPayload('access_token', client, user, scope);
    const r = generateJwtToken(
      payload,
      `${client.accessTokenLifetime! * 1000}`
    ); // ms
    debug(`generateAccessToken`, { args: { client, user, scope }, r });
    return Promise.resolve(r);
  },

  //

  generateRefreshToken: (
    client: Client,
    user: OauthModelUser,
    scope: string[]
  ): Promise<string> => {
    const payload = makeJwtUserPayload('refresh_token', client, user, scope);
    const r = generateJwtToken(
      payload,
      `${client.refreshTokenLifetime! * 1000}`
    ); // ms
    debug(`generateRefreshToken`, { args: { client, user, scope }, r });
    return Promise.resolve(r);
  },

  //

  getAccessToken: (accessToken: string): Promise<Token | Falsey> => {
    const r = {
      accessToken: 'accessToken',
      // accessTokenExpiresAt: new Date(),
      refreshToken: 'refreshToken',
      // refreshTokenExpiresAt: new Date(),
      scope: ['scopes'],
      // client: {...},
      // user: {},
    };
    debug(`getAccessToken`, { args: { accessToken }, r });
    throw new Error('Not implemented');
  },

  //

  /**
   * Invoked to save an access token and optionally a refresh token, depending on the grant type.
   */
  saveToken: async (
    token: Token,
    client: Client,
    user: OauthModelUser
  ): Promise<Token | Falsey> => {
    try {
      await pg.query(
        'call proc_oauth_tokens_save_tokens($1, $2, $3, $4, $5, $6, $7)',
        [
          client.id,
          user.session_id,
          JSON.stringify(token.scope),
          token.accessToken,
          token.accessTokenExpiresAt as Date,
          token.refreshToken as string,
          token.refreshTokenExpiresAt as Date,
        ]
      );
    } catch (e: any) {
      error('PG', e.message);
      return false;
    }
    debug(`saveToken`, { args: { token, client, user }, r: token });
    return { ...token, client, user };
  },

  //

  getRefreshToken: async (
    refreshToken: string
  ): Promise<RefreshToken | Falsey> => {
    let r: RefreshToken | Falsey = false;
    const qr = await pg.query(
      'select * from func_oauth_tokens_get_refresh_token($1)',
      [refreshToken]
    );
    const row = qr.next()!.oneRow();
    if (row)
      r = {
        refreshToken: row['refresh_token'] as string,
        scope: row['scope'] as string[],
        client: {
          id: row['client_id'] as string,
          grants: row['client_grants'] as string[],
          // redirectUris: [APP_FRONTEND_URL, ...row['client_redirect_uris']],
        },
        user: {
          id: row['user_id'],
          username: row['username'],
          session_id: row['session_id'],
        },
      };

    debug(`getRefreshToken`, { args: { refreshToken }, r });
    return r;
  },

  //
  /**
   * Invoked to revoke a refresh token.
   */
  revokeToken: async (token: RefreshToken | Token): Promise<boolean> => {
    let r = true;
    try {
      await pg.query('call proc_oauth_tokens_revoke_token($1)', [
        token.refreshToken as string,
      ]);
    } catch (e: any) {
      error('PG', e.message);
      r = false;
    }
    debug(`revokeToken (refresh token)`, { args: { token }, r });
    return Promise.resolve(r);
  },

  //

  generateAuthorizationCode: (
    client: Client,
    user: OauthModelUser,
    scope: string[]
  ): Promise<string> => {
    const r = `code_${makeUuid()}`;
    debug(`generateAuthorizationCode`, { args: { client, user, scope }, r });
    return Promise.resolve(r);
  },

  //

  getAuthorizationCode: async (
    authorizationCode: string
  ): Promise<AuthorizationCode | Falsey> => {
    let r: AuthorizationCode | Falsey = false;
    const qr = await pg.query('select * from func_oauth_tokens_get_code($1)', [
      authorizationCode,
    ]);
    const row = qr.next()!.oneRow();
    if (row) {
      const user: OauthModelUser = {
        id: row['user_id'] as string,
        username: row['username'] as string,
        session_id: row['session_id'] as string,
        validated_scope: row['scope'] as string[],
      };
      r = {
        authorizationCode: row['code'] as string,
        expiresAt: row['code_expires_on'] as Date,
        redirectUri: row['code_redirect_uri'] as string, // seems never used ?
        scope: row['scope'] as string[],
        client: {
          id: row['client_id'] as string,
          grants: row['client_grants'] as string[],
          // redirectUris: [APP_FRONTEND_URL, ...row['client_redirect_uris']],
        },
        user,
      };
    }

    debug(`getAuthorizationCode`, { args: { authorizationCode }, r });
    return r;
  },

  //

  saveAuthorizationCode: async (
    code: Pick<
      AuthorizationCode,
      | 'authorizationCode'
      | 'expiresAt'
      | 'redirectUri'
      | 'scope'
      | 'codeChallenge'
      | 'codeChallengeMethod'
    >,
    client: Client,
    user: OauthModelUser
  ): Promise<AuthorizationCode | Falsey> => {
    let r: AuthorizationCode | boolean = false;
    try {
      await pg.query(
        'call proc_oauth_tokens_save_code($1, $2, $3, $4, $5, $6)',
        [
          client.id,
          user.session_id,
          code.authorizationCode,
          code.expiresAt.toISOString(),
          JSON.stringify(code.scope),
          code.redirectUri,
        ]
      );
      r = {
        ...code,
        client,
        user,
      };
    } catch (e: any) {
      error('PG', e.message);
    }
    debug(`saveAuthorizationCode`, { args: { code, client, user }, r });
    return r;
  },

  //

  /**
   *
   */
  revokeAuthorizationCode: async (
    code: AuthorizationCode
  ): Promise<boolean> => {
    let r = true;
    try {
      await pg.query('call proc_oauth_tokens_revoke_code($1)', [
        code.authorizationCode,
      ]);
    } catch (e: any) {
      error('PG', e.message);
      r = false;
    }
    debug(`revokeAuthorizationCode`, { args: { code }, r });
    return Promise.resolve(r);
  },

  //

  /**
   * Invoked during request authentication to check if the provided access token was authorized the requested scopes.
   * This model function is required if scopes are used with OAuth2Server#authenticate() but it’s never called, if you provide your own authenticateHandler to the options.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyScope: (token: Token, scope: string | string[]): Promise<boolean> => {
    throw new Error('Not implemented, not called');
  },

  /**
   * Invoked to check if the requested scope is valid for a particular client/user combination.
   * This model function is optional. If not implemented, any scope is accepted.
   */
  validateScope: async (
    user: OauthModelUser,
    client: Client,
    scope: string[]
  ): Promise<string[]> => {
    let vs: string[] = [];

    // if scope value come from database (getAuthorizationCode), scope have been validated yet
    if (user.validated_scope) {
      vs = user.validated_scope;
    } else {
      vs = scope;
    }

    debug(`validateScope`, { args: { user, client, scope }, r: vs });
    return vs;
  },
};

//

//
//
//

export const authenticateHandler = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handle: (req: Request, res: Response): OauthModelUser | false => {
    let r: OauthModelUser | false = false;
    const u = userFromSession(req as Req);
    if (u) r = { ...u, session_id: (req as Req).sessionID };
    debug(`authenticateHandler.handle`, { r });
    return r;
  },
};

//

const makeJwtUserPayload = (
  type: 'access_token' | 'refresh_token',
  client: Client,
  user: OauthModelUser,
  scope: string[]
): TJwtUser => {
  return {
    type,
    client_id: client.id,
    user: { id: user.id, username: user.username },
    scope,
  };
};
