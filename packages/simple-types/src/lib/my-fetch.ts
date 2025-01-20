import { IncomingHttpHeaders } from 'http';
import { TJson } from './simple-types';

export type THeaders = { [k: string]: string };

export type TSerializableObject = { [k: string]: string | boolean | number };

export type TUri = {
  url: string;
  queryParameters?: TSerializableObject;
  pathParameters?: TSerializableObject;
};

export type TMyfetchRequest = TUri & {
  headers?: THeaders;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  jsonBody?: TJson;
  /** Content-Type multipart/form-data, curl -F / --form */
  formData?: TSerializableObject;
  /** content-type application/x-www-form-urlencoded, curl -d / --data */
  formUrlencoded?: TSerializableObject;
};

export type TMyfetch = (r: TMyfetchRequest) => Promise<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: TJson;
}>;

//
//

export const serialize = (values: TSerializableObject) => {
  const ps = [];
  for (const key in values) {
    // encodeURIComponent transform more caracters like '+'
    ps.push(`${key}=${encodeURIComponent(`${values[key]}`)}`);
  }
  const q = `${ps.join('&')}`;
  return q;
};

//
//

export const fullUri = (uri: TUri) => {
  let r = uri.url;

  // replace path parameters in url
  if (uri.pathParameters) {
    for (const key in uri.pathParameters) {
      r = r.replace(
        new RegExp(`\\{${key}\\}`, 'g'),
        `${uri.pathParameters[key]}`
      );
    }
  }

  // add query parameters
  let q = '';
  if (uri.queryParameters) q = serialize(uri.queryParameters);

  // join everything
  r = `${r}?${q}`;
  return r;
};
