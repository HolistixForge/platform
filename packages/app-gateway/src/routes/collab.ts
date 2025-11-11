import { Router, Request } from 'express';
import { BackendEventProcessor } from '@monorepo/reducers';
import { TProjectConfig } from '@monorepo/gateway';
import { log, NotFoundException } from '@monorepo/log';
import { myfetch } from '@monorepo/backend-engine';
import { asyncHandler } from '../middleware/route-handler';
import { VPN } from '../project-config';
import { CONFIG } from '../config';

let ROOM_ID = '';
let bep: BackendEventProcessor<any> | null = null;

export const setBackendEventProcessor = (
  processor: BackendEventProcessor<any>
) => {
  bep = processor;
};

export const setRoomId = (roomId: string) => {
  ROOM_ID = roomId;
};

export const getRoomId = () => ROOM_ID;

// This will be called from main.ts
export let startProjectCollabCallback:
  | ((config: TProjectConfig) => Promise<void>)
  | null = null;

export const setStartProjectCollabCallback = (
  callback: (config: TProjectConfig) => Promise<void>
) => {
  startProjectCollabCallback = callback;
};

export const setupCollabRoutes = (router: Router) => {
  // GET /collab/ping - Health check
  router.get('/collab/ping', ((_req: Request, res: any) => {
    return res.json({});
  }) as any);

  // POST /collab/event - Process collaborative event
  router.post(
    '/collab/event',
    asyncHandler(async (req: Request, res) => {
      if (!bep) {
        throw new NotFoundException([{ message: 'Collab data not bound' }]);
      }

      const { event } = req.body;
      // const authorizationHeader = req.headers.authorization as string;
      const jwt = (req as any).jwt; // Assuming JWT middleware sets this
      const user_id = jwt?.user_id || 'unknown';
      const ip = (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

      const requestData = {
        ip,
        user_id,
        jwt: jwt || {},
        headers: req.headers as any,
      };

      await bep.processEvent(event, requestData);

      return res.json({});
    })
  );

  // POST /collab/start - Initialize gateway with handshake
  router.post(
    '/collab/start',
    asyncHandler(async (req: Request, res) => {
      const { tmp_handshake_token } = req.body;

      log(6, 'GATEWAY', 'Starting collab with handshake token');

      // Call ganymede to get config
      const response = await myfetch({
        url: `https://${CONFIG.GANYMEDE_FQDN}/gateway/config`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { tmp_handshake_token },
      });

      const config = response.json as TProjectConfig;

      log(6, 'GATEWAY', 'Received config from Ganymede', { config });

      if (config.GANYMEDE_API_TOKEN && startProjectCollabCallback) {
        await startProjectCollabCallback(config);
      }

      return res.json({});
    })
  );

  // GET /collab/room-id - Get current room ID
  router.get('/collab/room-id', ((_req: Request, res: any) => {
    return res.json({ data: ROOM_ID });
  }) as any);

  // GET /collab/vpn-config - Get VPN configuration
  router.get('/collab/vpn-config', ((_req: Request, res: any) => {
    // TODO: Add JWT authorization check
    // Check if user has permission: p:{jwt.project_id}:project:vpn-access

    if (!VPN) {
      return res.status(500).json({ error: 'VPN config not available' });
    }

    const vpnConfig = {
      ...VPN,
      config: `client
dev tun
proto udp
remote GATEWAY_HOSTNAME ${VPN.port}
resolv-retry infinite
nobind
cipher AES-256-GCM
cert clients.crt
key clients.key
ca ca.crt
tls-client
tls-auth ta.key 1
# verb 5`,
    };

    return res.json({ data: vpnConfig });
  }) as any);
};
