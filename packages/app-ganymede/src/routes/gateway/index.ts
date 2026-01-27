import { Router, Request, RequestHandler } from 'express';
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
import { nginxManager } from '../../services/nginx-manager';
import { EPriority, log } from '@holistix-forge/log';
import {
  makeOrgGatewayHostname,
  makeOrgGatewayUrl,
} from '../../lib/url-helpers';

/**
 * Cleanup/rollback gateway allocation on failure
 * Returns gateway to pool and removes nginx config
 */
async function cleanupFailedAllocation(
  organization_id: string,
  reason: string
): Promise<void> {
  log(
    EPriority.Warning,
    'GATEWAY_CLEANUP',
    `Cleaning up failed allocation for org ${organization_id}: ${reason}`
  );

  try {
    // 1. Check if gateway was allocated
    const allocCheck = await pg.query(
      'SELECT gateway_id FROM func_organizations_get_active_gateway($1)',
      [organization_id]
    );
    const allocated = allocCheck.next()?.oneRow();

    if (!allocated) {
      log(
        EPriority.Info,
        'GATEWAY_CLEANUP',
        'No allocation found - failure before DB commit'
      );
      return;
    }

    const gateway_id = allocated['gateway_id'];
    log(
      EPriority.Warning,
      'GATEWAY_CLEANUP',
      `Deallocating gateway ${gateway_id}`
    );

    // 2. Mark gateway allocation as ended (returns to pool)
    await pg.query('CALL proc_organizations_gateways_stop($1)', [gateway_id]);
    log(EPriority.Info, 'GATEWAY_CLEANUP', '✅ Gateway returned to pool');

    // 3. Remove Nginx config (best-effort)
    try {
      await nginxManager.removeGatewayConfig(organization_id);
      await nginxManager.reloadNginx();
      log(EPriority.Info, 'GATEWAY_CLEANUP', '✅ Nginx config removed');
    } catch (nginxError: any) {
      // Non-critical - log and continue
      log(
        EPriority.Warning,
        'GATEWAY_CLEANUP',
        `Nginx cleanup warning: ${nginxError.message}`
      );
    }

    log(
      EPriority.Info,
      'GATEWAY_CLEANUP',
      `✅ Cleanup complete for org ${organization_id}`
    );
  } catch (error: any) {
    log(
      EPriority.Critical,
      'GATEWAY_CLEANUP',
      `❌ CLEANUP FAILED - Manual intervention required!`
    );
    log(
      EPriority.Critical,
      'GATEWAY_CLEANUP',
      `Org ${organization_id}: ${error.message}`
    );
    throw new Error(`Cleanup failed: ${error.message}`);
  }
}

export const setupGatewayRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // Note: Rate limiter is applied globally at app level for API routes
  // Individual endpoints use JWT authentication for access control
  // Mount data push/pull endpoints
  setupGatewayDataRoutes(router);
  // POST /gateway/start - Start gateway for organization
  router.post(
    '/gateway/start',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const { organization_id } = req.body;

      if (!organization_id) {
        return res.status(400).json({ error: 'Missing organization_id' });
      }

      if (!/^[a-f0-9-]{36}$/.test(organization_id)) {
        return res.status(400).json({ error: 'Invalid organization_id' });
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
          'CALL proc_organizations_start_gateway($1, $2, $3, $4, $5, $6, $7)',
          [organization_id, null, null, null, null, null, null]
        );
        const row = result.next()?.oneRow();

        if (!row) {
          throw new Error('Failed to allocate gateway from pool');
        }

        const container_name = row['container_name'] as string | null;
        const http_port = row['http_port'] as number;
        const gateway_nginx_upstream = row['gateway_nginx_upstream'] as string;
        const tmp_handshake_token = row['tmp_handshake_token'];

        // Validate that nginx_upstream was returned from database
        if (!gateway_nginx_upstream) {
          throw new Error(
            'Gateway allocation failed: gateway_nginx_upstream is missing from database'
          );
        }

        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Allocated ${container_name} (port ${http_port}, upstream ${gateway_nginx_upstream}) to org ${organization_id}`
        );

        // 2. Create Nginx config (routes org traffic to gateway)
        await nginxManager.createGatewayConfig(
          organization_id,
          gateway_nginx_upstream
        );

        // 3. Reload Nginx
        await nginxManager.reloadNginx();

        // 4. Construct gateway hostname and URL
        const gateway_hostname = makeOrgGatewayHostname(organization_id);
        const gateway_url = makeOrgGatewayUrl(organization_id);

        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Gateway accessible at: ${gateway_url}`
        );

        // 4.5. Wait for gateway to be ready (health check with timeout)
        log(EPriority.Info, 'GATEWAY_ALLOC', 'Checking gateway health...');

        const healthCheckTimeout = 5000; // 5s max
        const healthCheckInterval = 200; // Check every 200ms
        const startTime = Date.now();
        let isHealthy = false;

        while (Date.now() - startTime < healthCheckTimeout) {
          try {
            // Try to reach gateway health endpoint
            const healthUrl = `${gateway_url}/collab/ping`;
            const healthResponse = await fetch(healthUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(500), // 500ms timeout per request
            });

            if (healthResponse.ok) {
              isHealthy = true;
              const elapsed = Date.now() - startTime;
              log(
                EPriority.Info,
                'GATEWAY_ALLOC',
                `✅ Gateway healthy after ${elapsed}ms`
              );
              break;
            }
          } catch (error) {
            // Health check failed, retry
          }

          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, healthCheckInterval)
          );
        }

        if (!isHealthy) {
          throw new Error(
            `Gateway health check failed after ${healthCheckTimeout}ms. Gateway may not be ready.`
          );
        }

        // 5. Call gateway handshake
        const handshakeUrl = `${gateway_url}/collab/start`;
        log(
          EPriority.Info,
          'GATEWAY_ALLOC',
          `Calling gateway handshake: ${handshakeUrl}`
        );

        // Server-to-server call: Include Origin header to pass CSRF validation
        // The gateway's CSRF protection accepts requests from allowed origins
        const domain = process.env.DOMAIN || 'domain.local';
        const origin = `https://${domain}`;

        const handshakeResponse = await fetch(handshakeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
          },
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

        // CRITICAL: Cleanup on failure to prevent inconsistent state
        // If handshake or any step fails, we must rollback the allocation
        try {
          await cleanupFailedAllocation(organization_id, error.message);
        } catch (cleanupError: any) {
          // Cleanup failed - log critical error for manual intervention
          log(
            EPriority.Critical,
            'GATEWAY_ALLOC',
            `⚠️ ORPHANED ALLOCATION - Manual cleanup required!`,
            { organization_id, error: cleanupError.message }
          );
        }

        // Return appropriate error to user
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

      // Get organization projects
      const projectsResult = await pg.query(
        'SELECT * FROM func_projects_list_by_organization($1)',
        [organization_id]
      );
      const projects = projectsResult.next()?.allRows() || [];

      // Get organization members with roles (for Gateway RBAC initialization)
      const membersResult = await pg.query(
        'SELECT * FROM func_organizations_members_list($1)',
        [organization_id]
      );
      const members = membersResult.next()?.allRows() || [];

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
          role: String(m['role']), // 'owner', 'admin', or 'member'
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

        // 2. Remove Nginx config
        await nginxManager.removeGatewayConfig(organization_id);

        // 3. Reload Nginx
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
