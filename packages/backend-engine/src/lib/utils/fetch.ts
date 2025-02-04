import FormData from 'form-data';
import * as http from 'http';
import * as https from 'https';
import { development } from '../debug';
import { IncomingHttpHeaders } from 'http';
import {
  TJson,
  TMyfetch,
  TMyfetchRequest,
  fullUri,
  serialize,
} from '@monorepo/simple-types';

//
//

export type MyfetchResponse = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  response: string;
  json: TJson;
};

export const myfetch: TMyfetch = (request: TMyfetchRequest) => {
  const { headers = {}, method, formData, formUrlencoded, jsonBody } = request;

  return new Promise<MyfetchResponse>((resolve, reject) => {
    let _formData: FormData | null = null;
    let _xFormBody: string | null = null;
    let _jsonBody: string | null = null;

    const options = {
      headers,
      method,
    };

    //

    if (formData) {
      _formData = new FormData();
      for (const k in formData) {
        const v = formData[k];
        _formData.append(k, v);
      }
      options.headers = {
        ...options.headers,
        ..._formData?.getHeaders(),
      };
    }

    //
    else if (formUrlencoded) {
      _xFormBody = serialize(formUrlencoded);
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = `${Buffer.byteLength(_xFormBody)}`;
    } else if (jsonBody) {
      _jsonBody = JSON.stringify(jsonBody);
      options.headers['Content-Type'] = 'application/json';
    }

    //

    const full = fullUri(request);

    //

    const callback = (r: http.IncomingMessage) => {
      let response = '';
      // response.setEncoding('utf8');
      r.on('data', function (chunk) {
        response += chunk;
      });
      r.on('end', function () {
        const result = {
          statusCode: r.statusCode || 500,
          headers: r.headers,
          response,
          json:
            r.headers['content-type'] &&
            r.headers['content-type'].includes('application/json')
              ? JSON.parse(response)
              : undefined,
        };
        // log(7, '', `======> result`, result);
        resolve(result);
      });
    };

    //

    let req: http.ClientRequest;

    if (request.url.startsWith('http://'))
      req = http.request(full, options, callback);
    else if (request.url.startsWith('https://')) {
      // allow self signed certificate only in development
      development(() => {
        (options as any).rejectUnauthorized = false;
      });
      req = https.request(full, options, callback);
    } else throw new Error('protocol not supported');

    //

    req.on('error', function (err) {
      reject(err);
    });

    if (_formData) _formData.pipe(req);
    else if (_xFormBody) req.write(_xFormBody);
    else if (_jsonBody) req.write(_jsonBody);

    req.end();

    /*
    log(7, '', `======> call`, {
      options,
      'form-data': serialize(formData),
      'form-urlencoded': _xFormBody,
      json,
      uri: full,
    });
    */
  });
};
