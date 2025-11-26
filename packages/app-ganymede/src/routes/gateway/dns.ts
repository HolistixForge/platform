/**
 * Gateway DNS Management Endpoints
 *
 * Generic DNS management endpoints for FQDN to IP mapping.
 */

import { Router } from 'express';
import { EPriority, log } from '@monorepo/log';
import {
  authenticateJwtOrganization,
  OrganizationAuthRequest,
} from '../../middleware/auth';
import { asyncHandler } from '../../middleware/route-handler';
import { powerDNS } from '../../services/powerdns-client';

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

      log(
        EPriority.Info,
        'GATEWAY_DNS',
        `Registering DNS record: ${fqdn} → ${ip} (org ${organization_id})`
      );

      try {
        await powerDNS.registerRecord(fqdn, ip);

        log(EPriority.Info, 'GATEWAY_DNS', `✅ DNS record registered: ${fqdn}`);

        return res.json({
          success: true,
          message: 'DNS record registered',
        });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DNS',
          `Failed to register DNS record ${fqdn}:`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: 'Failed to register DNS record',
          details: error.message,
        });
      }
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

      log(
        EPriority.Info,
        'GATEWAY_DNS',
        `Deregistering DNS record: ${fqdn} (org ${organization_id})`
      );

      try {
        await powerDNS.deregisterRecord(fqdn);

        log(
          EPriority.Info,
          'GATEWAY_DNS',
          `✅ DNS record deregistered: ${fqdn}`
        );

        return res.json({
          success: true,
          message: 'DNS record deregistered',
        });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DNS',
          `Failed to deregister DNS record ${fqdn}:`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: 'Failed to deregister DNS record',
          details: error.message,
        });
      }
    })
  );
};
