import { createHmac } from 'crypto';

import { ForbiddenException } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';

import { InputSource } from './InputSource';
import { Request } from '../Request/Request';
import { JsonValue } from '../JsonValue';

//
//
//

const HMAC_KEY = process.env.HMAC_KEY;

//
//

export const makeHmacToken = (payload: TJson) => {
  if (!HMAC_KEY) throw new Error('No HMAC_KEY');

  try {
    const hmac = createHmac('sha512', HMAC_KEY);
    // stringify payload
    const payload_string = JSON.stringify(payload);
    // digest stringified payload
    hmac.update(payload_string);
    // retrieve hash
    const h = hmac.digest('hex');

    const t = JSON.stringify({ payload: payload_string, sign: h });

    const encoded = Buffer.from(t).toString('base64');

    return encoded;
  } catch (e) {
    throw new Error('failed to make hmac token');
  }
};

//
//

const checkHmacToken = (key: string, token: string): TJson => {
  try {
    // decode base64
    const decoded = Buffer.from(token, 'base64');
    // parse json
    const j = JSON.parse(decoded.toString());
    // payload field is still a json string, parse playload
    const payload = JSON.parse(j.payload);

    //
    // check token validity
    //

    const hmac = createHmac('sha512', key);
    // re stringify payload
    const payload_restring = JSON.stringify(payload);
    // digest stringified payload
    hmac.update(payload_restring);
    // retrieve hash
    const h = hmac.digest('hex');
    // check token signature equals recalculated signature
    if (j.sign !== h)
      throw new ForbiddenException([
        { message: 'invalid hmac token: invalid signature' },
      ]);

    return payload;
  } catch (err: any) {
    throw new ForbiddenException([{ message: 'invalid hmac token' }], err);
  }
};

//
//

export class HmacToken extends InputSource {
  get types() {
    return ['hmac'];
  }

  async get(type: string, id: string[], r?: Request) {
    let authorization: string | undefined = (await this._inputs.evalInput(
      'headers.authorization',
      r
    )) as string | undefined;

    const key = HMAC_KEY;

    /*
     * if no token anywhere, not an error, return null
     */
    if (!authorization || !key) return null;

    if (authorization.startsWith('token '))
      authorization = authorization.replace('token ', '');

    const payload = checkHmacToken(key, authorization);

    if (id[0] === '*') return payload;

    const jv = new JsonValue(payload);
    return jv.get(id, false) || null;
  }
}
