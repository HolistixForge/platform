import { Router, Request } from 'express';
import {
  authenticateJwtUser,
  authenticateJwtGateway,
  authenticateJwtOrganization,
  GatewayAuthRequest,
  OrganizationAuthRequest,
} from '../../middleware/auth';
import { pg } from '../../database/pg';
import { generateJwtToken } from '@holistix-forge/backend-engine';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';
import { setupGatewayDataRoutes } from './data';
import { setupGatewayDNSRoutes } from './dns';
import { powerDNS } from '../../services/powerdns-client';
import { nginxManager } from '../../services/nginx-manager';
import { EPriority, log } from '@holistix-forge/log';
import {
  makeOrgGatewayHostname,
  makeOrgGatewayUrl,
} from '../../lib/url-helpers';

export const setupGatewayRoutes = (router: Router) => {
  // Mount data push/pull endpoints
  setupGatewayDataRoutes(router);
  // Mount generic DNS management endpoints
  setupGatewayDNSRoutes(router);
  // POST /gateway/start - Start gateway for organization
  router.post(
    '/gateway/start',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const { organization_id } = req.body;

      if (!organization_id) {
        return res.status(400).json({ error: 'Missing organization_id' });
      }

      // Check user is org member
      const memberCheck = await pg.query(
        'SELECT 1 FROM organizations_members WHERE organization_id = $1 AND user_id = $2',
        [organization_id, req.user.id]
      );
      if (!memberCheck.next()?.oneRow()) {
        return res.status(403).json({ error: 'Not organization member' });
      }

      log(
        EPriority.Info,
        'GATEWAY_ALLOC',
        `Starting gateway for org ${organization_id}`
      );

      // Check if org already has allocated gateway
      const existingCheck = await pg.query(
        'SELECT * FROM func_organizations_get_active_gateway($1)',
        [organization_id]
      );
      const existing = existingCheck.next()?.oneRow();

      if (existing) {
        const gateway_hostname = makeOrgGatewayHostname(organization_id);
        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Gateway already allocated: ${gateway_hostname}`
        );
        return res.json({ gateway_hostname });
      }

      try {
        // 1. Allocate gateway from pool (database)
        const result = await pg.query(
          'CALL proc_organizations_start_gateway($1, $2, $3, $4, $5, $6)',
          [organization_id, null, null, null, null, null]
        );
        const row = result.next()?.oneRow();

        if (!row) {
          throw new Error('Failed to allocate gateway from pool');
        }

        const container_name = row['container_name'];
        const http_port = row['http_port'] as number;
        const tmp_handshake_token = row['tmp_handshake_token'];

        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Allocated ${container_name} (port ${http_port}) to org ${organization_id}`
        );

        // 2. Register DNS (org-{uuid}.domain.local → 127.0.0.1)
        await powerDNS.registerGateway(organization_id);

        // 3. Create Nginx config (routes org traffic to gateway HTTP port)
        await nginxManager.createGatewayConfig(organization_id, http_port);

        // 4. Reload Nginx
        await nginxManager.reloadNginx();

        // 5. Construct gateway hostname and URL
        const gateway_hostname = makeOrgGatewayHostname(organization_id);
        const gateway_url = makeOrgGatewayUrl(organization_id);

        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Gateway accessible at: ${gateway_url}`
        );

        // 6. Call gateway handshake
        const handshakeUrl = `${gateway_url}/collab/start`;
        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Calling gateway handshake: ${handshakeUrl}`
        );

        const handshakeResponse = await fetch(handshakeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmp_handshake_token }),
        });

        if (!handshakeResponse.ok) {
          const errorText = await handshakeResponse.text();
          throw new Error(
            `Gateway handshake failed: ${handshakeResponse.status} ${errorText}`
          );
        }

        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `✅ Gateway started successfully for org ${organization_id}`
        );

        return res.json({ gateway_hostname });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_ALLOC',
          `Failed to start gateway for org ${organization_id}:`,
          error.message
        );

        // TODO: Cleanup on failure (deallocate, remove DNS, remove nginx config)

        if (error.message.includes('no_gateway_available')) {
          return res
            .status(503)
            .json({ error: 'No available gateways in pool. Try again later.' });
        }

        return res.status(500).json({
          error: 'Failed to start gateway',
          details: error.message,
        });
      }
    })
  );

  // POST /gateway/config - Gateway calls this with handshake token
  // NOTE: Uses temporary handshake token, not gateway JWT (token generated here)
  router.post(
    '/gateway/config',
    asyncHandler(async (req: Request, res) => {
      const { tmp_handshake_token } = req.body;

      // Get org from handshake token
      const result = await pg.query(
        'SELECT * FROM func_organizations_gateways_get($1)',
        [tmp_handshake_token]
      );
      const row = result.next()?.oneRow();
      if (!row) {
        return res.status(403).json({ error: 'Invalid handshake token' });
      }

      const organization_id = row['organization_id'];
      const gateway_id = row['gateway_id'];

      // Get organization details
      const orgResult = await pg.query(
        'SELECT * FROM func_organizations_get_by_id($1)',
        [organization_id]
      );
      const org = orgResult.next()?.oneRow();

      // Get organization members
      const membersResult = await pg.query(
        'SELECT * FROM func_organizations_members_list($1)',
        [organization_id]
      );
      const members = membersResult.next()?.allRows() || [];

      // Get organization projects
      const projectsResult = await pg.query(
        'SELECT * FROM func_projects_list_by_organization($1)',
        [organization_id]
      );
      const projects = projectsResult.next()?.allRows() || [];

      // Generate organization JWT token (gateway bound to org)
      const organizationToken = generateJwtToken(
        {
          type: 'organization_token',
          organization_id: String(organization_id),
          gateway_id: String(gateway_id),
          scope: 'gateway:api-access',
        },
        '365d'
      );

      return res.json({
        organization_id: String(organization_id),
        organization_name: String(org?.['name']),
        gateway_id: String(gateway_id),
        organization_token: organizationToken,
        projects: projects.map((p) => String(p['project_id'])),
        members: members.map((m) => ({
          user_id: String(m['user_id']),
          username: String(m['username']),
          role: String(m['role']),
        })),
      });
    })
  );

  // POST /gateway/ready - Gateway signals it's ready
  router.post(
    '/gateway/ready',
    authenticateJwtGateway,
    asyncHandler(async (req: GatewayAuthRequest, res) => {
      const { gateway_id } = req.body;

      // Verify gateway_id matches token
      if (gateway_id !== req.gateway.id) {
        return res.status(403).json({ error: 'Gateway ID mismatch' });
      }

      await pg.query('CALL proc_gateways_set_ready($1)', [gateway_id]);
      return res.json({ success: true });
    })
  );

  // POST /gateway/stop - Stop gateway (called when org deallocates)
  router.post(
    '/gateway/stop',
    authenticateJwtOrganization,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      const organization_id = req.organization.id;
      const gateway_id = req.organization.gateway_id;

      log(
        EPriority.Info,
        'GATEWAY_DEALLOC',
        `Stopping gateway ${gateway_id} for org ${organization_id}`
      );

      try {
        // 1. Mark gateway allocation as ended in database
        await pg.query('CALL proc_organizations_gateways_stop($1)', [
          gateway_id,
        ]);

        // 2. Remove DNS records
        await powerDNS.deregisterGateway(organization_id);

        // 3. Remove Nginx config
        await nginxManager.removeGatewayConfig(organization_id);

        // 4. Reload Nginx
        await nginxManager.reloadNginx();

        log(
          EPriority.Info,
          'GATEWAY_DEALLOC',
          `✅ Gateway deallocated, returned to pool (ready for next org)`
        );

        return res.json({ success: true });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DEALLOC',
          `Failed to stop gateway:`,
          error.message
        );

        return res.status(500).json({
          error: 'Failed to stop gateway',
          details: error.message,
        });
      }
    })
  );
};
