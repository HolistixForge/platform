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
import { TJson, makeUuid } from '@monorepo/simple-types';
import { CONFIG } from '../config';
import { pg } from '../pg';
import { userFromSession } from '../totp';
import { Req, UserSerializedInfo } from '../main';
import {
  GLOBAL_CLIENT_ID,
  TServerImageOptions,
  USER_SCOPE,
  makeProjectScopeString,
  serverAccessScope,
} from '@monorepo/demiurge-types';
import { development, generateJwtToken } from '@monorepo/backend-engine';

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
    let r: Client | Falsey = false;
    const qr = await pg.query('select * from func_oauth_clients_get($1)', [
      clientId,
    ]);
    const row = qr.next()!.oneRow();

    const image_options = row['image_options'] as TServerImageOptions;
    const oauthClientOptions = row['service_name']
      ? image_options.oauthClients?.find(
          (oc) => oc.serviceName === row['service_name']
        )
      : undefined;

    // if a valid client is found
    if (
      row
      // TODO:
      // we don't check client secret because:
      // - authorize request do not send client secret field
      // - oauth flow are also done from frontend to get token to demiurge APIs and jupyterlab server APIs
      //   so not usefull if client secret value must be hanging somewhere in the frontend
      // - jupyterlab server send a irevelant client secret
      //   (the API TOKEN used for activity reporting, set from JUPYTERHUB_API_TOKEN env)
    ) {
      const uris = (row['redirect_uris'] as string[])
        .map((uri) => [
          uri.replace(
            'DYNREDIR',
            `https://${row['gateway_hostname']}/${row['project_server_id']}/${row['service_name']}`
          ),
          uri.replace(
            'DYNREDIR',
            // uri for service which need a fix redirect_uri to be configured at startup (jupyterlab)
            // as project gateway changes, a fix redirect_uri can't be setup for those services
            // so we use this dynamic redirection endpoint of ganymede that redirect to the same path
            // on the active project gateway
            `https://${CONFIG.GANYMEDE_FQDN}/dynredir/${row['project_server_id']}/${row['service_name']}`
          ),
        ])
        .flat();

      let accessTokenLifetime = ACCESS_TOKEN_LIFETIME;

      if (oauthClientOptions?.accessTokenLifetime)
        accessTokenLifetime = oauthClientOptions.accessTokenLifetime;

      r = {
        id: row['client_id'] as string,
        grants: row['grants'] as string[],
        redirectUris: [CONFIG.APP_FRONTEND_URL, ...uris],
        accessTokenLifetime,
        refreshTokenLifetime: REFRESH_TOKEN_LIFETIME,
      };
    }

    debug(`getClient`, { args: { clientId, clientSecret }, r });
    return r;
  },

  //

  generateAccessToken: (
    client: Client,
    user: OauthModelUser,
    scope: string[]
  ): Promise<string> => {
    const payload = JwtPayload('access_token', client, user, scope);
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
    const payload = JwtPayload('refresh_token', client, user, scope);
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
      // General purpose token
      if (client.id === GLOBAL_CLIENT_ID) {
        for (let i = 0; i < scope.length; i++) {
          // for each requested scope,
          // if it match 'p:xxx', user ask for its permissions for project xxx
          const s = scope[i];
          const regex =
            /^p:([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})$/;
          const matchResult = s.match(regex);
          if (matchResult) {
            // Extracted number is in the first capturing group (index 1)
            const project_id: string = matchResult[1];
            vs.push(...(await getUserProjectScope(user.id, project_id)));
          }
        }
      }
      // else if it is a token for a server
      else {
        // get server project_id from client.id
        const qr = await pg.query('select * from func_oauth_clients_get($1)', [
          client.id,
        ]);
        const row = qr.next()!.oneRow();
        if (row) {
          const project_id = row['project_id'] as string;
          if (project_id) {
            const userProjectScope = await getUserProjectScope(
              user.id,
              project_id
            );
            // check user own scope 'server:access' on project 'project_id'
            const s = makeProjectScopeString(project_id, 'server:access');
            if (userProjectScope.includes(s)) {
              vs.push(serverAccessScope(client.id));
            }
          }
        }
      }
    }

    debug(`validateScope`, { args: { user, client, scope }, r: vs });
    return vs;
  },
};

//

/**
 * Get the user's scope from the database and add the project prefix
 * in front of each scope
 * @param user_id
 * @param project_id
 * @returns
 */
const getUserProjectScope = async (user_id: string, project_id: string) => {
  let vs: string[] = [];
  const qr = await pg.query(
    'select * from func_projects_members_get_user_scope($1, $2)',
    [project_id, user_id]
  );
  const row = qr.next()!.oneRow();

  if (row) {
    // project owner has all scope on the project
    if (row['is_owner']) {
      vs = vs.concat(
        [makeProjectScopeString(project_id)],
        USER_SCOPE.map((s: string) => makeProjectScopeString(project_id, s))
      );
    }
    // else user has scope from the database
    else if (Array.isArray(row['scope'])) {
      vs = vs.concat(
        [makeProjectScopeString(project_id)],
        (row['scope'] as string[]).map((s) =>
          makeProjectScopeString(project_id, s)
        )
      );
    }
  }
  return vs;
};

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

const JwtPayload = (
  type: 'access_token' | 'refresh_token',
  client: Client,
  user: OauthModelUser,
  scope: string[]
): TJson => {
  return {
    type,
    client_id: client.id,
    user: { id: user.id, username: user.username },
    scope,
  };
};
