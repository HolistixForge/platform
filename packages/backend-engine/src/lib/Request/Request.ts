import { Response } from '../Response/Response';
import { TJson } from '@monorepo/simple-types';

export type TStringMap = {
  [k: string]: string;
};

export type TRequestData = {
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json: TJson;
  getParameters: TStringMap;
  headers: TStringMap;
  path: string;
  pathParameters: TStringMap;
};

export class Request {
  _data: TRequestData;
  _response: Response = new Response();
  isEventSource = false;
  stop = false;

  constructor(r: TRequestData) {
    this._data = r;
  }

  get path() {
    return this._data.path;
  }

  get httpMethod() {
    return this._data.httpMethod;
  }

  get response() {
    return this._response;
  }

  toJson() {
    return JSON.stringify(this._data);
  }
}
