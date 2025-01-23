import { EventSourcePolyfill } from 'event-source-polyfill';
import { ApiFetch } from '@monorepo/api-fetch';
import { log } from '@monorepo/log';
import { TJson, TMyfetchRequest } from '@monorepo/simple-types';
import { Tokens, doOauthCode } from './oauth-client';
import {
  GLOBAL_CLIENT_ID,
  GLOBAL_CLIENT_SECRET,
  makeProjectScopeString,
} from '@monorepo/demiurge-types';
import { Key, LocalStorageStore } from './local-storage-store';

//
//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debug = (msg: string, ...args: any) => log(7, 'API_CALL', msg, ...args);

type TokenStoreValue = {
  token: Tokens;
  scope: string;
  client_id: string;
  client_secret: string;
};

//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTokenConfig = (k: any): Omit<TokenStoreValue, 'token'> => {
  let conf: Omit<TokenStoreValue, 'token'>;
  if (k['project_id'])
    conf = {
      client_id: GLOBAL_CLIENT_ID,
      client_secret: GLOBAL_CLIENT_SECRET,
      scope: makeProjectScopeString(k['project_id']), // ask all owned authorizations for this project
    };
  else if (k['client_id'])
    conf = {
      client_id: k['client_id'],
      client_secret: GLOBAL_CLIENT_SECRET,
      scope: 'none',
    };
  else
    conf = {
      client_id: GLOBAL_CLIENT_ID,
      client_secret: GLOBAL_CLIENT_SECRET,
      scope: `none`,
    };
  return conf;
};

//
//
//
//

/**
 * wrap over ApiFetch to handle tokens refresh
 */
export class GanymedeApi extends ApiFetch {
  //
  _accountApi: ApiFetch;
  _frontendUrl: string;
  _ts: LocalStorageStore<TokenStoreValue>;

  constructor(baseUrl: string, frontendUrl: string, accountApi: ApiFetch) {
    super(baseUrl);
    this._accountApi = accountApi;
    this._frontendUrl = frontendUrl;
    this._ts = new LocalStorageStore<TokenStoreValue>({
      //
      get: (
        k: Key
      ): Promise<{ value: TokenStoreValue; expire: Date } | null> => {
        const conf = getTokenConfig(k);
        return doOauthCode({
          fetch: this._accountApi.fetch.bind(this._accountApi),
          redirect_uri: this._frontendUrl,
          ...conf,
        }).then((t) => {
          if (t)
            return {
              value: { ...conf, token: t },
              expire: new Date(new Date().getTime() + t.expires_in * 1000),
            };
          else return null;
        });
      },
      //
      refresh: (
        k: Key,
        tokenData: TokenStoreValue
      ): Promise<{ value: TokenStoreValue; expire: Date } | null> => {
        return (
          this._accountApi.fetch({
            url: `oauth/token`,
            method: 'POST',
            formUrlencoded: {
              grant_type: 'refresh_token',
              client_id: tokenData.client_id,
              client_secret: tokenData.client_secret,
              refresh_token: tokenData.token.refresh_token,
            },
          }) as Promise<Tokens>
        ).then((t) => {
          if (t)
            return {
              value: { ...tokenData, token: t },
              expire: new Date(new Date().getTime() + t.expires_in * 1000),
            };
          else return null;
        });
      },
    });
  }

  /**
   * check if error is due to token expiration
   * @returns boolean
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _isTokenRefreshError(err: any) {
    const r =
      err &&
      err.status === 401 &&
      err.json?.errors?.[0]?.message === 'REFRESH_TOKEN';
    debug('isTokenRefreshError', {
      err,
      status: err.status,
      message: err.json?.errors?.[0]?.message,
      r,
    });
    return r;
  }

  /**
   * Choose a token based on the request content.
   * If a project_id is present, choose the project token
   * If a client_id is present, choose the pod token.
   * @param r
   * @returns
   */
  private _getTokenKeyForRequest(
    r: Pick<TMyfetchRequest, 'queryParameters' | 'pathParameters' | 'jsonBody'>
  ): TJson {
    const client_id: string =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r.jsonBody && (r.jsonBody as any).event?.client_id) || null;
    if (client_id) return { client_id };

    const project_id = (r.queryParameters?.['project_id'] ||
      r.pathParameters?.['project_id']) as string | undefined;
    if (project_id) return { project_id };

    // else : default general token
    return { global: true };
  }

  //

  /**
   * catch REFRESH_TOKEN error,
   * do refresh the token and redo the initial request
   * @param r
   * @returns
   */
  private async _doTokenLogic<T>(
    r: Pick<
      TMyfetchRequest,
      'url' | 'headers' | 'queryParameters' | 'pathParameters' | 'jsonBody'
    >,
    func: () => Promise<T>
  ) {
    let retried = 0;
    do {
      const tokenKey = this._getTokenKeyForRequest(r);

      let v;
      do {
        v = this._ts.get(tokenKey);
        if (v.promise) await v.promise;
      } while (!v.value);

      debug('fetch', { request: r, token: v.value });

      try {
        r.headers = { ...r.headers, authorization: v.value.token.access_token };
        return await func();
      } catch (err) {
        // if the request returned an error indicating need to refresh the user token
        if (this._isTokenRefreshError(err) && retried === 0) {
          // todo ?
          throw new Error('WTF');
          // and retry the initial request only once
          retried++;
        }
        // any other error is thrown, so no retry
        else throw err;
      }

      // eslint-disable-next-line no-constant-condition
    } while (true);
  }

  //

  override async fetch(r: TMyfetchRequest, host?: string): Promise<TJson> {
    return this._doTokenLogic<TJson>(r, () => super.fetch(r, host));
  }

  //

  override async eventSource(
    r: Pick<
      TMyfetchRequest,
      'url' | 'headers' | 'queryParameters' | 'pathParameters'
    >,
    onMessage: (event: MessageEvent, es: EventSourcePolyfill) => void,
    host?: string
  ): Promise<EventSourcePolyfill> {
    return this._doTokenLogic(r, () => super.eventSource(r, onMessage, host));
  }

  //

  public reset() {
    this._ts.reset();
  }
}
