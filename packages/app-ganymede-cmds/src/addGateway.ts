import { generateJwtToken, jwtPayload } from '@monorepo/backend-engine';
import {
  GATEWAY_SCOPE,
  makeGatewayScopeString,
} from '@monorepo/demiurge-types';
import { ONE_YEAR_MS } from '@monorepo/simple-types';
import { pg } from './pg';
import { log } from '@monorepo/log';

//

const gatewayGlobalToken = (gateway_id: string) =>
  generateJwtToken(
    {
      type: 'gateway_token',
      gateway_id,
      scope: GATEWAY_SCOPE.map((s) =>
        makeGatewayScopeString(gateway_id, s.name)
      ).join(' '),
    },
    `${ONE_YEAR_MS}` // TODO: adjust expiration ?
  );

//
//

export const addGateway = async (fqdn: string, version: string) => {
  const r = await pg.query('call proc_gateway_new($1, $2, $3)', [
    fqdn,
    version,
    null,
  ]);
  const gwId = r.next()!.oneRow()['gateway_id'] as string;

  const token = gatewayGlobalToken(gwId);

  log(6, 'NEW_GATEWAY', `${fqdn}: ${gwId}`);
  log(6, 'NEW_GATEWAY', `toekn: ${token}`);

  const payload = jwtPayload(token);
  log(6, 'NEW_GATEWAY', `payload: `, payload);
};
