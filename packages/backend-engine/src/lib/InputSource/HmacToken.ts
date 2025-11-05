import * as crypto from 'crypto';
import { TJson } from '@monorepo/simple-types';

/**
 * Generate an HMAC token
 */
export const makeHmacToken = (
  secret: string,
  data: TJson,
  algorithm: string = 'sha256'
): string => {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
};
