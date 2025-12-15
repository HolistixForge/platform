import { EventSourcePolyfill } from 'event-source-polyfill';
import { ApiFetch } from '@holistix-forge/api-fetch';
import { TJson, TMyfetchRequest } from '@holistix-forge/simple-types';
import { Tokens, doOauthCode } from './oauth-client';
import { GLOBAL_CLIENT_ID, GLOBAL_CLIENT_SECRET } from '@holistix-forge/types';
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
      // IMPORTANT: Use super.fetch (not this.fetch) to avoid circular dependency!
      // this.fetch wraps calls in _doTokenLogic which tries to get a token,
      // but we're already IN the process of getting/refreshing a token here.
      //
      get: (
        k: Key
      ): Promise<{ value: TokenStoreValue; expire: Date } | null> => {
        const conf = getTokenConfig();
        return doOauthCode({
          fetch: super.fetch.bind(this), // ← Use super.fetch to bypass _doTokenLogic
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
          super.fetch({
            // ← Use super.fetch to bypass _doTokenLogic
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
  private _getTokenKeyForRequest(): string {
    return 'user';
  }

  //

  /**
   * Acquire token and execute request with authorization.
   *
   * This wraps API calls with automatic token management:
   * 1. Acquire/retrieve OAuth token (with retries if needed)
   * 2. Execute the actual API call with token in headers
   * 3. Handle token refresh errors if needed
   *
   * @param r - Request parameters
   * @param func - The actual API call function
   * @returns Promise with API response
   * @throws Error if token acquisition fails after max retries
   */
  private async _doTokenLogic<T>(
    r: Pick<
      TMyfetchRequest,
      'url' | 'headers' | 'queryParameters' | 'pathParameters' | 'jsonBody'
    >,
    func: () => Promise<T>
  ) {
    // Max attempts to acquire token before giving up
    // Each attempt waits for promise (which may include 30s retry delay)
    const MAX_TOKEN_ATTEMPTS = 3;

    let retried = 0;
    do {
      const tokenKey = this._getTokenKeyForRequest();

      let v;
      let tokenAttempts = 0;

      // Keep trying to get token until we have a value or exceed max attempts
      do {
        v = this._ts.get(tokenKey);

        // If we have a value, break out
        if (v.value) {
          break;
        }

        // No value yet, check if we've exceeded max attempts
        if (tokenAttempts >= MAX_TOKEN_ATTEMPTS) {
          const error = new Error(
            `Failed to acquire authentication token after ${MAX_TOKEN_ATTEMPTS} attempts. ` +
              `This usually means OAuth authorization is failing or timing out. ` +
              `Check network connectivity and OAuth configuration.`
          );
          debug('token acquisition failed', {
            tokenKey,
            attempts: tokenAttempts,
            lastState: v,
          });
          throw error;
        }

        // Wait for promise if available (token fetch or retry is in progress)
        if (v.promise) {
          debug('waiting for token', { tokenKey, attempt: tokenAttempts + 1 });
          await v.promise;
        }

        tokenAttempts++;
      } while (!v.value);

      debug('fetch', { request: r, token: v.value });

      try {
        r.headers = { ...r.headers, authorization: v.value.token.access_token };
        return await func();
      } catch (err) {
        // If the request returned an error indicating need to refresh the user token
        if (this._isTokenRefreshError(err) && retried === 0) {
          debug('token refresh needed, clearing cached token and retrying');
          // Clear the cached token to force a refresh on next iteration
          this._ts.reset();
          // Retry the initial request only once
          retried++;
          continue; // Loop back to acquire fresh token
        }
        // Any other error is thrown, no retry
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
