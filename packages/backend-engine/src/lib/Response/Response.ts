import { log } from '@monorepo/log';
import { JsonValue } from '../JsonValue';
import { TStringMap } from '../Request/Request';
import { TJson, TUri } from '@monorepo/simple-types';

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
  _jsonBody = new JsonValue();
  _redirection: TUri | null = null;
  _cookies: Array<TCookie> = [];
  _serverSentEvents: string[] = [];

  get statusCode() {
    return this._statusCode;
  }

  get headers(): TStringMap {
    return this._headers;
  }

  addHeaders(headers: TStringMap) {
    this._headers = { ...this._headers, ...headers };
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

  get body() {
    return JSON.stringify(this._jsonBody.value);
  }

  bodyObject() {
    return this._jsonBody.value;
  }

  set(key: string, value: TJson) {
    this._jsonBody.graft(key, value);
  }

  setStatusCode(statusCode: number) {
    this._statusCode = statusCode;
  }

  redirect(r: TUri) {
    this._redirection = r;
  }

  addCookies(cookies: Array<TCookie>): void {
    log(7, '', 'adding cookies', cookies);
    this._cookies = this._cookies.concat(
      cookies.map((c) => {
        if (typeof c.value === 'object') c.value = JSON.stringify(c.value);
        return c;
      })
    );
  }

  _log() {
    if (this.serverSentEvents.length)
      return {
        serverSentEvents: this.serverSentEvents,
      };
    else
      return {
        statusCode: this._statusCode,
        headers: this._headers,
        body: this._jsonBody.value,
        redirection: this._redirection,
        cookies: this._cookies,
      };
  }
}
