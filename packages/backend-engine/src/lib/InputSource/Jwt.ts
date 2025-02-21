import * as jwt from 'jsonwebtoken';

import { log } from '@monorepo/log';
import { TJson } from '@monorepo/simple-types';
import { ForbiddenException } from '@monorepo/log';

import {
  ConfigException,
  OAuthRefreshTokenException,
} from '../Exceptions/Exception';
import { InputSource } from './InputSource';
import { JsonValue } from '../JsonValue';
import { Request } from '../Request/Request';
import { Inputs } from './Inputs';
import { myfetch } from '../utils/fetch';

//
//

export const generateJwtToken = (payload: TJson, expiresIn = '1h'): string => {
  const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
  if (!JWT_PRIVATE_KEY) throw new ConfigException('no JWT_PRIVATE_KEY');
  const token = jwt.sign(
    payload as object,
    JWT_PRIVATE_KEY as jwt.PrivateKey,
    {
      algorithm: 'RS256',
      expiresIn,
    } as jwt.SignOptions
  );
  return token;
};

//
//

export class Jwt extends InputSource {
  _cookieName?: string;

  constructor(i: Inputs, cookieName?: string) {
    super(i);
    this._cookieName = cookieName;
  }

  //

  get types() {
    return ['jwt'];
  }

  //

  async get(type: string, id: string[], r?: Request) {
    /*
     * A valid JWT is expected in the HTTP header "authorization"
     */
    let authorization: string | undefined = (await this._inputs.evalInput(
      'headers.authorization',
      r
    )) as string | undefined;

    let authToken: string | undefined = authorization;

    if (authToken?.startsWith('token ')) {
      authToken = authToken.replace('token ', '');

      /*
       * if authorization is not a JWT, check cookie instead.
       * Need for: jupyterlab Oauth authorize redirection to ganymede.
       */
      const jwtRegEx = /^(?:[\w-]*\.){2}[\w-]*$/;
      if (!jwtRegEx.test(authToken)) authToken = undefined;
    }

    if (!authToken && this._cookieName) {
      /*
       *  else we get access token from cookie if it exists
       */
      const userCookie = (await this._inputs.evalInput(
        `cookie.${this._cookieName}`,
        r
      )) as string;
      if (userCookie) {
        try {
          authToken = JSON.parse(userCookie).access_token;
        } catch (err: any) {
          throw new ForbiddenException(
            [{ message: 'invalid user cookie, failed to parse' }],
            err
          );
        }
      }
    }

    /*
     * if no token anywhere, not an error, return null
     */
    if (!authToken) return null;

    const payload: any = jwtPayload(authToken);

    if (
      ![
        'access_token',
        'gateway_token',
        'server_token',
        'project_token',
      ].includes(payload.type)
    )
      throw new ForbiddenException([
        { message: `invalid jwt token: not an access token` },
      ]);

    if (id[0] === '*') return payload;
    if (id[0] === 'user_id') return payload.user?.id;
    if (id[0] === 'username') return payload.user?.username;

    const jv = new JsonValue(payload);
    return jv.get(id, false);
  }
}

//

let publicKey = process.env.JWT_PUBLIC_KEY;

const getPublicKey = async () => {
  if (!publicKey) {
    if (process.env.ACCOUNT_FQDN) {
      try {
        const r = await myfetch({
          url: `https://${process.env.ACCOUNT_FQDN}/oauth/public-key`,
          method: 'GET',
        });
        publicKey = (r.json as { publicKey: string }).publicKey;
      } catch (error) {
        log(7, 'PUBLIC_KEY', 'failed to get tokens public key', error);
      }
    } else throw new Error('No public key for token validation');
  }
};

getPublicKey();

//

export const jwtPayload = (token: string) => {
  let payload;
  try {
    payload = jwt.verify(token, publicKey as jwt.PublicKey, {
      algorithms: ['RS256'],
    });
    return payload;
  } catch (err: any) {
    if (err.constructor.name === 'TokenExpiredError') {
      log(7, 'JWT', 'token need refresh');
      throw new OAuthRefreshTokenException();
    }
    throw new ForbiddenException([{ message: `invalid jwt token` }], err);
  }
};
