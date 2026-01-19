import { generateJwtToken, jwtPayload } from '@holistix-forge/backend-engine';
import { TJwtGateway } from '@holistix-forge/types';
import { ONE_YEAR_MS } from '@holistix-forge/simple-types';
import { pg } from './pg';
import { EPriority, log } from '@holistix-forge/log';

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
  version: string,
  containerName: string,
  httpPort: number,
  vpnPort: number,
  nginxUpstream: string
) => {
  // nginxUpstream MUST be explicitly provided
  // This is the address that Stage 1 Nginx will use to reach this gateway
  // Examples:
  //   Development: '172.17.0.1:7103' (Docker host via bridge gateway)
  //   Production: '10.0.0.20:7103' (internal network address)
  if (!nginxUpstream) {
    throw new Error('nginxUpstream is required');
  }

  const r = await pg.query(
    'call proc_gateway_new($1, $2, $3, $4, $5, NULL)',
    [version, containerName, httpPort, vpnPort, nginxUpstream]
  );
  const gwId = r.next()!.oneRow()['gateway_id'] as string;

  const token = gatewayGlobalToken(gwId);

  const payload = jwtPayload(token);
  log(EPriority.Info, 'NEW_GATEWAY', `payload:`, payload);

  console.log('');
  console.log('gateway_id:', gwId);
  console.log('token:', token);
};
