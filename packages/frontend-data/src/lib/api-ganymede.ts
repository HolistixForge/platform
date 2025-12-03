import { EventSourcePolyfill } from 'event-source-polyfill';
import { ApiFetch } from '@holistix/api-fetch';
import { TJson, TMyfetchRequest } from '@holistix/simple-types';
import { Tokens, doOauthCode } from './oauth-client';
import {
  GLOBAL_CLIENT_ID,
  GLOBAL_CLIENT_SECRET,
} from '@holistix/types';
import { Key, LocalStorageStore } from './local-storage-store';
import { browserLog } from './browser-log';

//
//

const debug = (msg: string, ...args: any) =>
  browserLog('debug', 'API_CALL', msg, { data: { args } });

type TokenStoreValue = {
  token: Tokens;
  scope: string;
  client_id: string;
  client_secret: string;
};

//

/**
 * Get token configuration for OAuth flow.
 * Simplified to always return the same config since we only need a single user token.
 */
const getTokenConfig = (): Omit<TokenStoreValue, 'token'> => {
  return {
    client_id: GLOBAL_CLIENT_ID,
    client_secret: GLOBAL_CLIENT_SECRET,
    scope: 'none',
  };
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
  _frontendUrl: string;
  _ts: LocalStorageStore<TokenStoreValue>;
  // Map of organization_id -> gateway_hostname
  _organizationGateways: Map<string, string> = new Map();

  constructor(baseUrl: string, frontendUrl: string) {
    super(baseUrl);
    this._frontendUrl = frontendUrl;
    this._ts = new LocalStorageStore<TokenStoreValue>({
      //
      get: (
        k: Key
      ): Promise<{ value: TokenStoreValue; expire: Date } | null> => {
        const conf = getTokenConfig();
        return doOauthCode({
          fetch: this.fetch.bind(this),
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
          this.fetch({
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
   * Get token key for request.
   * @returns Single token key
   */
  private _getTokenKeyForRequest(): TJson {
    return { user: true };
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
      const tokenKey = this._getTokenKeyForRequest();

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

  /**
   * Set gateway hostname for an organization
   * @param organization_id - Organization ID
   * @param gateway_hostname - Gateway hostname (without protocol)
   */
  setGatewayHostname(organization_id: string, gateway_hostname: string): void {
    this._organizationGateways.set(organization_id, gateway_hostname);
  }

  /**
   * Get gateway hostname for an organization
   * @param organization_id - Organization ID
   * @returns Gateway hostname or null if not set
   */
  getGatewayHostname(organization_id: string): string | null {
    return this._organizationGateways.get(organization_id) || null;
  }

  /**
   * Fetch from gateway API for a specific organization
   * Reuses all token management logic
   * @param r - Request
   * @param organization_id - Organization ID (used to get gateway hostname). If not provided, uses current organization.
   * @param project_id - Optional project ID (for token selection)
   */
  async fetchGateway(
    r: TMyfetchRequest,
    organization_id?: string,
    project_id?: string
  ): Promise<TJson> {
    // Use provided organization_id or fall back to current
    const orgId = organization_id;
    if (!orgId) {
      throw new Error(
        'Organization ID required. Either provide it as parameter or set gateway hostname first.'
      );
    }

    const gateway_hostname = this.getGatewayHostname(orgId);
    if (!gateway_hostname) {
      throw new Error(
        `Gateway hostname not set for organization ${orgId}. Organization may not have running projects.`
      );
    }

    // Inject project_id if provided (for token selection)
    if (project_id) {
      if (!r.pathParameters) {
        r.pathParameters = {};
      }
      r.pathParameters['project_id'] = project_id;
    }

    // Use existing token logic with gateway host
    const gatewayUrl = `https://${gateway_hostname}`;
    return this._doTokenLogic<TJson>(r, () => super.fetch(r, gatewayUrl));
  }

  public reset() {
    this._ts.reset();
    this._organizationGateways.clear();
  }
}
