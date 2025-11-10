import { generateJwtToken, jwtPayload } from '@monorepo/backend-engine';
import {
  GATEWAY_SCOPE,
  makeGatewayScopeString,
  TJwtGateway,
} from '@monorepo/demiurge-types';
import { ONE_YEAR_MS } from '@monorepo/simple-types';
import { pg } from './pg';
import { log } from '@monorepo/log';

//

const gatewayGlobalToken = (gateway_id: string) => {
  const payload: TJwtGateway = {
    type: 'gateway_token',
    gateway_id,
    scope: GATEWAY_SCOPE.map((s) =>
      makeGatewayScopeString(gateway_id, s.name)
    ).join(' '),
  };
  return generateJwtToken(
    payload,
    `${ONE_YEAR_MS}` // TODO: adjust expiration ?
  );
};

//
//

export const addGateway = async (fqdn: string, version: string) => {
  const r = await pg.query('call proc_gateway_new($1, $2, NULL)', [
    fqdn,
    version,
  ]);
  const gwId = r.next()!.oneRow()['gateway_id'] as string;

  const token = gatewayGlobalToken(gwId);

  const payload = jwtPayload(token);
  log(6, 'NEW_GATEWAY', `payload:`, payload);

  console.log('');
  console.log('gateway_id:', gwId);
  console.log('token:', token);
};
