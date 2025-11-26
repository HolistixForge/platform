import { EPriority, log } from '@monorepo/log';
import { TJson, TStringMap } from '@monorepo/simple-types';

//
//

export type TCookie = {
  name: string;
  value: TJson;
  options: {
    expires?: string;
    domain?: string;
    maxAge?: number;
  };
};

//
//

export class Response {
  _statusCode = 200;
  _headers: TStringMap = {};
  _jsonBody: TJson = {};
  _redirection: string | null = null;
  _cookies: Array<TCookie> = [];
  _serverSentEvents: string[] = [];

  get statusCode() {
    return this._statusCode;
  }

  get headers(): TStringMap {
    return this._headers;
  }

  get body() {
    return JSON.stringify(this._jsonBody);
  }

  get serverSentEvents(): string[] {
    return this._serverSentEvents;
  }

  addServerSentEvents(es: string[]) {
    this._serverSentEvents = this._serverSentEvents.concat(es);
  }

  clearServerSentEvents() {
    this._serverSentEvents = [];
  }

  bodyObject() {
    return this._jsonBody;
  }

  bodyJson() {
    return JSON.stringify(this._jsonBody);
  }

  addJsonBodyField(key: string, value: any) {
    (this._jsonBody as any)[key] = value;
  }

  setStatusCode(statusCode: number) {
    this._statusCode = statusCode;
  }

  setRedirection(uri: string) {
    this._redirection = uri;
  }

  redirectionUrl(): string | null {
    return this._redirection;
  }

  addCookies(cookies: Array<TCookie>): void {
    log(EPriority.Debug, '', 'adding cookies', cookies);
    this._cookies = this._cookies.concat(
      cookies.map((c) => ({
        ...c,
        options: {
          ...c.options,
          expires: c.options.expires
            ? new Date(c.options.expires).toUTCString()
            : undefined,
        },
      }))
    );
  }
}
