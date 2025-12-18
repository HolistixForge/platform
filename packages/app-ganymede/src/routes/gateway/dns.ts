/**
 * Gateway DNS Management Endpoints
 *
 * NOTE: These endpoints are now NO-OPs since we use wildcard DNS (*.domain.local).
 * All subdomains (org-{uuid}, uc-{uuid}, etc.) automatically resolve via the wildcard.
 * Kept for backward compatibility with existing gateways.
 */

import { Router } from 'express';
import { EPriority, log } from '@holistix-forge/log';
import {
  authenticateJwtOrganization,
  OrganizationAuthRequest,
} from '../../middleware/auth';
import { asyncHandler } from '../../middleware/route-handler';

export const setupGatewayDNSRoutes = (router: Router) => {
  /**
   * Register DNS record (FQDN → IP)
   * POST /gateway/dns/register
   *
   * Called by gateway to register any DNS record.
   *
   * Body:
   * {
   *   "fqdn": "uc-xyz.org-abc.domain.local",
   *   "ip": "127.0.0.1"
   * }
   */
  router.post(
    '/gateway/dns/register',
    authenticateJwtOrganization,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      const { fqdn, ip } = req.body;
      const organization_id = req.organization.id;

      if (!fqdn || !ip) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: fqdn, ip',
        });
      }

      // NO-OP: Wildcard DNS (*.domain.local) automatically handles all subdomains
      // No explicit DNS record creation needed
      log(
        EPriority.Debug,
        'GATEWAY_DNS',
        `DNS registration request received for ${fqdn} → ${ip} (org ${organization_id}) - no-op (wildcard DNS)`
      );

      return res.json({
        success: true,
        message: 'DNS record registered (via wildcard DNS)',
      });
    })
  );

  /**
   * Deregister DNS record
   * DELETE /gateway/dns/deregister
   *
   * Called by gateway to remove a DNS record.
   *
   * Body:
   * {
   *   "fqdn": "uc-xyz.org-abc.domain.local"
   * }
   */
  router.delete(
    '/gateway/dns/deregister',
    authenticateJwtOrganization,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      const { fqdn } = req.body;
      const organization_id = req.organization.id;

      if (!fqdn) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: fqdn',
        });
      }

      // NO-OP: Wildcard DNS (*.domain.local) means no explicit records to remove
      log(
        EPriority.Debug,
        'GATEWAY_DNS',
        `DNS deregistration request received for ${fqdn} (org ${organization_id}) - no-op (wildcard DNS)`
      );

      return res.json({
        success: true,
        message: 'DNS record deregistered (via wildcard DNS)',
      });
    })
  );
};
