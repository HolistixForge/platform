import { Router, Request } from 'express';
import { BackendEventProcessor } from '@holistix-forge/reducers';
import { EPriority, log, NotFoundException } from '@holistix-forge/log';
import { myfetch } from '@holistix-forge/backend-engine';
import { asyncHandler } from '../middleware/route-handler';
import { VPN } from '../config/organization';
import { CONFIG } from '../config';
import { initializeGatewayForOrganization } from '../initialization/gateway-init';
import { authenticateJwt, requireScope } from '../middleware/jwt-auth';
import { requireProjectAccess } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';

let bep: BackendEventProcessor<any> | null = null;

export const setBackendEventProcessor = (
  processor: BackendEventProcessor<any>
) => {
  bep = processor;
};

export const setupCollabRoutes = (router: Router) => {
  // GET /collab/ping - Health check
  router.get('/collab/ping', ((_req: Request, res: any) => {
    return res.json({});
  }) as any);

  // POST /collab/event - Process collaborative event
  router.post(
    '/collab/event',
    authenticateJwt,
    requireProjectAccess(), // Check project access if project_id is in JWT
    asyncHandler(async (req: Request, res) => {
      if (!bep) {
        throw new NotFoundException([{ message: 'Collab data not bound' }]);
      }

      const authReq = req as any;
      const { event } = req.body;
      const user_id = authReq.user.id;
      const ip = (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

      const requestData = {
        ip,
        user_id,
        jwt: authReq.jwt || {},
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

      log(EPriority.Info, 'GATEWAY', 'Starting collab with handshake token');

      // Call ganymede to get config
      const response = await myfetch({
        url: `https://${CONFIG.GANYMEDE_FQDN}/gateway/config`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { tmp_handshake_token },
      });

      const config = response.json as {
        organization_id: string;
        organization_token: string;
        gateway_id: string;
      };

      log(EPriority.Info, 'GATEWAY', 'Received config from Ganymede', { config });

      // Initialize gateway with organization context
      if (
        config.organization_token &&
        config.organization_id &&
        config.gateway_id
      ) {
        // Initialize gateway (this will pull data from Ganymede)
        await initializeGatewayForOrganization(
          config.organization_id,
          config.gateway_id,
          config.organization_token
        );

        log(EPriority.Info, 'GATEWAY', 'Gateway initialized from /collab/start');
      }

      return res.json({});
    })
  );

  // GET /collab/room-id - Get room ID for a project
  router.get(
    '/collab/room-id',
    authenticateJwt,
    requireProjectAccess(), // Requires project_id in JWT or query and checks access
    asyncHandler(async (req: Request, res) => {
      const authReq = req as any;

      // Get project_id from JWT, query, or params (in that order of precedence)
      const project_id =
        authReq.jwt?.project_id ||
        (req.query.project_id as string) ||
        authReq.params?.project_id;

      if (!project_id) {
        throw new NotFoundException([{ message: 'Project ID required' }]);
      }

      const instances = getGatewayInstances();
      if (!instances) {
        throw new NotFoundException([
          { message: 'Gateway instances not initialized' },
        ]);
      }

      const room_id = instances.projectRooms.getRoomId(project_id);

      if (!room_id) {
        throw new NotFoundException([
          {
            message: `Project ${project_id} not initialized or room not found`,
          },
        ]);
      }

      return res.json({ data: room_id });
    })
  );

  // GET /collab/vpn-config - Get VPN configuration
  // Requires JWT token with 'org:{org_id}:connect-vpn' scope (organization-specific)
  router.get(
    '/collab/vpn-config',
    authenticateJwt, // Extract and attach JWT
    requireScope('org:{org_id}:connect-vpn'), // Verify token has org-specific scope
    asyncHandler(async (req: Request, res) => {
      if (!VPN) {
        return res.status(500).json({ error: 'VPN config not available' });
      }

      const vpnConfig = {
        ...VPN,
        config: `client
dev tun
proto udp
remote GATEWAY_FQDN ${VPN.port}
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
    })
  );
};
