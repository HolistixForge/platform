import { Router, Request, RequestHandler } from 'express';
import { EPriority, log, NotFoundException } from '@holistix-forge/log';
import { asyncHandler } from '../middleware/route-handler';
import { initializeGatewayForOrganization } from '../initialization/gateway-init';
import { fetchConfigFromGanymede } from '../initialization/fetch-config';
import { authenticateJwt, requireScope } from '../middleware/jwt-auth';
import { requireProjectAccess } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';
import {
  loadVpnConfig,
  isVpnValidForOrg,
  stopVpn,
  startVpnAsync,
} from '../vpn/vpn-manager';

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
  // Both user tokens and container tokens send project_id in the body
  router.post(
    '/collab/event',
    authenticateJwt,
    requireProjectAccess(), // Handles both user tokens and container tokens (see middleware)
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        throw new NotFoundException([{ message: 'Gateway not initialized' }]);
      }

      const authReq = req as any;
      const jwt = authReq.jwt;
      const { event } = req.body;
      const ip = (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

      // Get user_id - container tokens don't have one (use empty string)
      // Reducers check JWT type to determine if it's a container token
      const user_id = authReq.user?.id || '';

      // project_id comes from request body for both user and container tokens
      // (container scripts now include project_id in event payload)
      const project_id = req.body.project_id;

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
        jwt: jwt || {},
        headers: req.headers as any,
        project_id,
      };

      await instances.reducers.processEvent(event, requestData);

      return res.json({});
    })
  );

  router.post(
    '/collab/start',
    asyncHandler(async (req: Request, res) => {
      log(EPriority.Info, 'COLLAB_START', 'Initialization trigger received');

      const config = await fetchConfigFromGanymede();

      if (!config) {
        return res.status(404).json({
          error: 'Gateway not allocated to any organization',
        });
      }

      // Initialize gateway first (fast)
      const { getServers } = await import('../servers');
      const servers = getServers();

      await initializeGatewayForOrganization(
        config.organization_id,
        config.gateway_id,
        config.organization_token,
        servers,
        config.members,
        config.project_names
      );

      // Start VPN asynchronously AFTER gateway init (VPN not critical for frontend)
      const existingVpn = loadVpnConfig();

      if (!isVpnValidForOrg(existingVpn, config.organization_id)) {
        if (existingVpn) {
          log(EPriority.Info, 'VPN', `Stopping old VPN (org mismatch)`);
          stopVpn();
        }

        log(
          EPriority.Info,
          'VPN',
          `Starting VPN asynchronously for org ${config.organization_id}...`
        );
        startVpnAsync(config.organization_id).catch((err) => {
          log(EPriority.Error, 'VPN', `VPN startup failed: ${err.message}`);
        });
      } else {
        log(EPriority.Info, 'VPN', '✅ VPN already valid for organization');
      }

      if (config.projects && config.projects.length > 0) {
        log(
          EPriority.Info,
          'COLLAB_START',
          `Gateway has ${config.projects.length} projects (will initialize on demand)`
        );
      } else {
        log(
          EPriority.Info,
          'COLLAB_START',
          'No projects registered for this organization'
        );
      }

      log(EPriority.Info, 'COLLAB_START', '✅ Gateway initialized');

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

      // Check if project is already initialized
      let room_id = instances.projectRooms.getRoomId(project_id);

      // If not initialized, initialize NOW (lazy initialization)
      if (!room_id) {
        log(
          EPriority.Info,
          'COLLAB',
          `🔄 Lazy initializing project: ${project_id}`
        );

        const startTime = Date.now();

        try {
          room_id = await instances.projectRooms.initializeProject(project_id);

          const duration = Date.now() - startTime;
          log(
            EPriority.Info,
            'COLLAB',
            `✅ Project initialized in ${duration}ms: ${project_id}, room: ${room_id}`
          );
        } catch (error: any) {
          log(
            EPriority.Error,
            'COLLAB',
            `Failed to initialize project ${project_id}: ${error.message}`,
            error
          );
          throw new NotFoundException([
            {
              message: `Failed to initialize project ${project_id}: ${error.message}`,
            },
          ]);
        }
      }

      return res.json({ data: room_id });
    })
  );

  // GET /collab/vpn-config - Get VPN configuration
  // Requires JWT token with 'org:{org_id}:connect-vpn' scope (organization-specific)
  router.get(
    '/collab/vpn-config',
    authenticateJwt,
    requireScope('org:{org_id}:connect-vpn'),
    asyncHandler(async (req: Request, res) => {
      const vpn = loadVpnConfig();

      if (!vpn) {
        return res.status(503).json({ error: 'VPN not available' });
      }

      const vpnConfig = {
        ...vpn,
        config: `client
dev tun
proto udp
remote GATEWAY_FQDN ${vpn.port}
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

      return res.json(vpnConfig);
    })
  );
};
