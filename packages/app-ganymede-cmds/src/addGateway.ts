import { generateJwtToken, jwtPayload } from '@monorepo/backend-engine';
import { TJwtGateway } from '@monorepo/demiurge-types';
import { ONE_YEAR_MS } from '@monorepo/simple-types';
import { pg } from './pg';
import { EPriority, log } from '@monorepo/log';

//

const gatewayGlobalToken = (gateway_id: string) => {
  const payload: TJwtGateway = {
    type: 'gateway_token',
    gateway_id,
    scope: `gateway:${gateway_id}:ready gateway:${gateway_id}:stop`,
  };
  return generateJwtToken(
    payload,
    `${ONE_YEAR_MS}` // TODO: adjust expiration ?
  );
};

//
//

export const addGateway = async (
  fqdn: string,
  version: string,
  containerName: string,
  httpPort: number,
  vpnPort: number
) => {
  const r = await pg.query('call proc_gateway_new($1, $2, $3, $4, $5, NULL)', [
    fqdn,
    version,
    containerName,
    httpPort,
    vpnPort,
  ]);
  const gwId = r.next()!.oneRow()['gateway_id'] as string;

  const token = gatewayGlobalToken(gwId);

  const payload = jwtPayload(token);
  log(EPriority.Info, 'NEW_GATEWAY', `payload:`, payload);

  console.log('');
  console.log('gateway_id:', gwId);
  console.log('token:', token);
};
