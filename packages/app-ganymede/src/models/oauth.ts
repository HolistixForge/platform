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

import { EPriority, error, log } from '@holistix-forge/log';
import { makeUuid } from '@holistix-forge/simple-types';
import { development, generateJwtToken } from '@holistix-forge/backend-engine';
import { GLOBAL_CLIENT_ID, TJwtUser } from '@holistix-forge/types';
import bcrypt from 'bcryptjs';

import { CONFIG } from '../config';
import { tunnelRedirectUris } from '../lib/public-routing';
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
  log(EPriority.Debug, 'OAUTH_MODEL', msg, o);
};

//

const parseUrl = (value: string): URL | undefined => {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

// Only the addresses that cannot be routed to from another machine. Not
// `localhost`: what it resolves to is up to the host's resolver, so it is not a
// guarantee that the code stays on the machine (RFC 8252 §8.3 says the same).
const isLoopback = (url: URL): boolean =>
  url.hostname === '127.0.0.1' || url.hostname === '[::1]';

//

export const model: AuthorizationCodeModel &
  RefreshTokenModel & { verifyScope: AuthorizationCodeModel['verifyScope'] } = {
  //

  getClient: async (
    clientId: string,
    clientSecret: string
  ): Promise<Client | Falsey> => {
    // 1. DB lookup: check oauth_clients table
    try {
      const qr = await pg.query(
        'SELECT * FROM oauth_clients WHERE client_id = $1',
        [clientId]
      );
      const result = qr.next();
      const row = result?.oneRow();

      if (row) {
        // Check expiration
        if (
          row['expires_at'] &&
          new Date(row['expires_at'] as string) < new Date()
        ) {
          debug('getClient', { clientId, r: false, reason: 'expired' });
          return false;
        }

        // Validate secret if provided (null during authorize phase)
        if (clientSecret) {
          const secretHash = row['client_secret_hash'] as string | null;
          if (secretHash) {
            // New-style client with bcrypt hash
            const valid = await bcrypt.compare(clientSecret, secretHash);
            if (!valid) {
              debug('getClient', {
                clientId,
                r: false,
                reason: 'bad secret (bcrypt)',
              });
              return false;
            }
          } else {
            // Legacy client with plaintext secret
            if (
              row['client_secret'] !== clientSecret &&
              row['client_secret'] !== 'none'
            ) {
              debug('getClient', {
                clientId,
                r: false,
                reason: 'bad secret (legacy)',
              });
              return false;
            }
          }
        }

        const redirectUris =
          typeof row['redirect_uris'] === 'string'
            ? JSON.parse(row['redirect_uris'])
            : row['redirect_uris'];
        const grants =
          typeof row['grants'] === 'string'
            ? JSON.parse(row['grants'])
            : row['grants'];

        // The built-in client's redirect target is deployment configuration,
        // not data: it is whatever host this instance serves the frontend on.
        // 03-data.sql seeds the row with placeholders ("https://example.com")
        // and a comment saying to update them after deployment, so taking the
        // stored value at face value means every freshly created database
        // ships a global client the frontend can never use — authorization
        // fails with "redirect_uri does not match client value", no token is
        // issued, and the app renders signed-in but empty. Databases created
        // before that seed existed had no row at all and fell through to the
        // config-derived fallback below, which is why this only surfaces on a
        // new environment. Custom clients keep their own registered URIs.
        //
        // The tunnel origin joins that list for the same reason and by the
        // same argument: it is deployment configuration, only discovered per
        // request rather than at startup. It is empty unless this request came
        // in on a hostname outside the configured domain — see
        // lib/public-routing.ts.
        const isGlobalClient = row['client_id'] === GLOBAL_CLIENT_ID;
        const effectiveRedirectUris = isGlobalClient
          ? [
              CONFIG.APP_FRONTEND_URL,
              CONFIG.APP_FRONTEND_URL_DEV,
              ...tunnelRedirectUris(),
            ]
          : (redirectUris as string[]);

        const client: Client = {
          id: row['client_id'] as string,
          grants: grants as string[],
          redirectUris: effectiveRedirectUris,
          accessTokenLifetime:
            (row['access_token_lifetime'] as number) || ACCESS_TOKEN_LIFETIME,
          refreshTokenLifetime:
            (row['refresh_token_lifetime'] as number) || REFRESH_TOKEN_LIFETIME,
        };

        debug('getClient', { clientId, r: true });
        return client;
      }
    } catch (e: any) {
      error('OAUTH_MODEL', `getClient DB lookup failed: ${e.message}`);
    }

    // 2. Fallback: hardcoded global client (backward compat)
    if (clientId === GLOBAL_CLIENT_ID) {
      return {
        id: GLOBAL_CLIENT_ID,
        grants: ['authorization_code', 'refresh_token'],
        redirectUris: [
          CONFIG.APP_FRONTEND_URL,
          CONFIG.APP_FRONTEND_URL_DEV,
          ...tunnelRedirectUris(),
        ],
        accessTokenLifetime: ACCESS_TOKEN_LIFETIME,
        refreshTokenLifetime: REFRESH_TOKEN_LIFETIME,
      };
    }

    debug('getClient', { args: { clientId, clientSecret }, r: false });
    return false;
  },

  //

  /**
   * Invoked to check that the `redirect_uri` of an authorize request is one the
   * client registered.
   *
   * The library's own check is `client.redirectUris.includes(redirectUri)`, and
   * that stays the rule here for everything that is not a loopback address —
   * this function only ever widens the match for `127.0.0.1` and `[::1]`.
   *
   * Loopback needs the exception because of the port. A client running on
   * someone's machine — the runner — receives its authorization code on a
   * server it starts locally, and it cannot register the port in advance: a
   * fixed port is one already-bound socket away from an enrolment that cannot
   * start, on a laptop where anything else may hold it. RFC 8252 §7.3 has the
   * client take whatever port the OS gives it and the server ignore the port
   * when matching. Everything else still has to match — scheme, host, path —
   * and only a host that cannot be reached from outside the machine qualifies,
   * so widening this costs nothing: a code sent to 127.0.0.1 leaves no network.
   */
  validateRedirectUri: async (
    redirectUri: string,
    client: Client
  ): Promise<boolean> => {
    // The library types this as `string | string[]`, and `includes` on the
    // string form would match a substring — a different rule than the one this
    // is meant to preserve.
    const registered =
      typeof client.redirectUris === 'string'
        ? [client.redirectUris]
        : client.redirectUris ?? [];

    if (registered.includes(redirectUri)) return true;

    const requested = parseUrl(redirectUri);
    if (!requested || !isLoopback(requested)) {
      debug('validateRedirectUri', {
        args: { redirectUri, clientId: client.id },
        r: false,
      });
      return false;
    }

    // A redirect that already carries a query is refused: the response
    // parameters are appended to it, and a client that put its own there is not
    // one whose exact registration we can be sure we are matching.
    if (requested.search || requested.hash) return false;

    const r = registered.some((uri) => {
      const candidate = parseUrl(uri);
      return (
        !!candidate &&
        isLoopback(candidate) &&
        candidate.protocol === requested.protocol &&
        candidate.hostname === requested.hostname &&
        candidate.pathname === requested.pathname
      );
    });

    debug('validateRedirectUri', {
      args: { redirectUri, clientId: client.id },
      r,
    });
    return r;
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
    const result = qr.next();
    if (!result) {
      debug(`getRefreshToken`, {
        args: { refreshToken },
        r: false,
        reason: 'No result from query',
      });
      return false;
    }
    const row = result.oneRow();
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
    const result = qr.next();
    if (!result) {
      debug(`getAuthorizationCode`, {
        args: { authorizationCode },
        r: false,
        reason: 'No result from query',
      });
      return false;
    }
    const row = result.oneRow();
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
        // Only set when the authorize request carried a challenge. The library
        // verifies a code_verifier if and only if it finds a challenge here —
        // returning nothing means the exchange is accepted without proof, so
        // these two lines are the whole of PKCE enforcement.
        ...(row['code_challenge']
          ? {
              codeChallenge: row['code_challenge'] as string,
              codeChallengeMethod: row['code_challenge_method'] as string,
            }
          : {}),
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
        'call proc_oauth_tokens_save_code($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          client.id,
          user.session_id,
          code.authorizationCode,
          // Pass Date object directly instead of code.expiresAt.toISOString()
          // toISOString() converts to "2025-12-16T17:03:50.507Z" which PostgreSQL
          // stores in "timestamp without time zone" column, treating it as local time
          // and losing UTC context. Passing Date object preserves timezone correctly.
          code.expiresAt,
          JSON.stringify(code.scope),
          code.redirectUri,
          // The library already validated the shape of these on the way in
          // (43-128 unreserved characters, method 'S256' or 'plain'); dropping
          // them here is what left every public client unable to enrol.
          code.codeChallenge ?? null,
          code.codeChallengeMethod ?? null,
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
      vs = scope ?? [];
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
