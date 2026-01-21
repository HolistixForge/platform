import { Router, Request, RequestHandler } from 'express';
import { BackendEventProcessor } from '@holistix-forge/reducers';
import { EPriority, log, NotFoundException } from '@holistix-forge/log';
import { asyncHandler } from '../middleware/route-handler';
import { VPN } from '../config/organization';
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

export const setupCollabRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // Note: Rate limiter is applied globally at app level for API routes
  // Individual endpoints use JWT authentication for access control
  // GET /collab/ping - Health check
  router.get('/collab/ping', ((_req: Request, res: any) => {
    return res.json({});
  }) as any);

  // POST /collab/event - Process collaborative event
  // Requires project_id in request body for multi-project architecture
  router.post(
    '/collab/event',
    authenticateJwt,
    requireProjectAccess(), // Check project access if project_id is in JWT or body
    asyncHandler(async (req: Request, res) => {
      if (!bep) {
        throw new NotFoundException([{ message: 'Collab data not bound' }]);
      }

      const authReq = req as any;
      const { event, project_id } = req.body;
      const user_id = authReq.user.id;
      const ip = (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

      // project_id is required for multi-project architecture
      // It tells reducers which project's YJS doc to operate on
      if (!project_id) {
        throw new NotFoundException([
          { message: 'project_id is required in request body' },
        ]);
      }

      const requestData = {
        ip,
        user_id,
        jwt: authReq.jwt || {},
        headers: req.headers as any,
        project_id,
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

      // Call ganymede to get config using centralized client
      const { createGanymedeClient } = await import('../lib/ganymede-client');
      const ganymedeClient = createGanymedeClient();

      const config = await ganymedeClient.request<{
        organization_id: string;
        organization_token: string;
        gateway_id: string;
        projects: string[];
        members: Array<{ user_id: string; username: string; role: string }>;
      }>({
        method: 'POST',
        url: '/gateway/config',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { tmp_handshake_token },
      });

      log(EPriority.Info, 'GATEWAY', 'Received config from Ganymede', {
        config,
      });

      // Initialize gateway with organization context
      if (
        config.organization_token &&
        config.organization_id &&
        config.gateway_id
      ) {
        // Get servers for WebSocket grafting
        const { getServers } = await import('../servers');
        const servers = getServers();
        
        // Initialize gateway (this will pull data from Ganymede)
        const instances = await initializeGatewayForOrganization(
          config.organization_id,
          config.gateway_id,
          config.organization_token,
          servers  // Pass servers for WebSocket grafting
        );

        log(
          EPriority.Info,
          'GATEWAY',
          `Gateway initialized from /collab/start (${config.projects.length} projects, ${config.members.length} members)`
        );

        // Initialize projects received from Ganymede
        if (config.projects && config.projects.length > 0) {
          log(
            EPriority.Info,
            'GATEWAY',
            `Initializing ${config.projects.length} projects...`
          );

          for (const project_id of config.projects) {
            try {
              await instances.projectRooms.initializeProject(project_id);
              log(
                EPriority.Info,
                'GATEWAY',
                `✅ Project initialized: ${project_id}`
              );
            } catch (error: any) {
              log(
                EPriority.Error,
                'GATEWAY',
                `Failed to initialize project ${project_id}: ${error.message}`
              );
            }
          }

          log(
            EPriority.Info,
            'GATEWAY',
            `✅ All projects initialized (${config.projects.length} projects)`
          );
        } else {
          log(
            EPriority.Warning,
            'GATEWAY',
            'No projects to initialize for this organization'
          );
        }
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
