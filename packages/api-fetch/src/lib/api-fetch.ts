import { EventSourcePolyfill } from 'event-source-polyfill';
import {
  THeaders,
  TJson,
  TMyfetchRequest,
  TUri,
  fullUri,
} from '@holistix-forge/simple-types';

/**
 * concatenate all errors messages, adding '.' between message
 * @param errors
 * @returns
 */

interface IAuth {
  authorization?: () => { headers: THeaders };
  credentials?: 'include';
}

//
//
//

/**
 * Blank out query parameters that carry a credential.
 *
 * The URI is going into an error message, and error messages are logged,
 * shipped to the collector and pasted into issues. Some routes take a token in
 * the query string because the client cannot set a header there — a WebSocket
 * upgrade, an EventSource. Which route failed is the useful half; the token is
 * not, and it should not travel with it.
 */
function redactSecrets(uri: string): string {
  return uri.replace(
    /([?&](?:token|access_token|refresh_token|api_key|apikey)=)[^&#]*/gi,
    '$1REDACTED'
  );
}

function formUrlEncode(o: object) {
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(o)) {
    formData.append(key, value as string);
  }
  return formData;
}

//
//
//

export class ApiFetch {
  _host?: string;
  _auth: IAuth | undefined;

  constructor(host?: string, auth?: IAuth) {
    this._host = host;
    this._auth = auth;
  }

  protected getHost() {
    return this._host;
  }

  private _getFullUri(r: TUri, host?: string): string {
    const h = host || this.getHost();
    if (!h) throw new Error('no base url');
    if (!r.url.startsWith(h)) r.url = `${h}/${r.url}`;
    const uri = fullUri(r);
    return uri;
  }

  /**
   * Build and start HTTP request. add fully qualified API domain name
   * and user authentication token
   */
  async fetch(r: TMyfetchRequest, host?: string): Promise<TJson> {
    const uri = this._getFullUri(r, host);

    if (!r.headers) r.headers = {};
    let body = undefined;

    /* If user is logged, add his API access token in request */
    if (this._auth?.authorization) {
      const { headers } = this._auth.authorization();
      r.headers = { ...r.headers, ...headers };
    }

    if (r.jsonBody && r.method !== 'GET') {
      r.headers['Content-type'] = 'application/json; charset=UTF-8';
      body = JSON.stringify(r.jsonBody);
    } else if (r.formUrlencoded) {
      r.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = formUrlEncode(r.formUrlencoded);
    }

    const { method, headers } = r;
    const rf: RequestInit = {
      method,
      headers,
      body,
      credentials: this._auth?.credentials,
    };

    const response = await fetch(uri, rf);

    const json = await response.json();

    // Accept all 2xx status codes as successful responses
    // 2xx range includes: 200 OK, 201 Created, 204 No Content, 206 Partial Content, etc.
    if (response.status < 200 || response.status >= 300) {
      // The status and the address go in the message, not only on the object.
      // An uncaught rejection prints `error.message` and its stack and nothing
      // else, and a bundled stack names `k$2.fetch` — so "API error" alone
      // says a request failed and refuses to say which one or how. Measured on
      // a page opened while its gateway was still being allocated: two red
      // lines in the console, no method, no URL, no status.
      const e = new Error(
        `API error: ${response.status} ${method} ${redactSecrets(uri)}`
      );

      (e as any).status = response.status;

      (e as any).json = json; // { errors: [ {message: "" }, ... ] }
      throw e;
    }
    return json;
  }

  //
  //

  async eventSource(
    r: Pick<
      TMyfetchRequest,
      'url' | 'headers' | 'queryParameters' | 'pathParameters'
    >,
    onMessage: (event: MessageEvent, es: EventSourcePolyfill) => void,
    host?: string
  ): Promise<EventSourcePolyfill> {
    const uri = this._getFullUri(r, host);

    /* If user is logged, add his API access token in request */
    if (this._auth?.authorization) {
      const { headers } = this._auth.authorization();
      r.headers = { ...r.headers, ...headers };
    }

    const es = new EventSourcePolyfill(uri, {
      // withCredentials: true,
      headers: r.headers,
    });

    es.onmessage = (e) => {
      onMessage(e as MessageEvent, es);
    };

    return es;
  }
}
