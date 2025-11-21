/**
 * Gateway Data Storage Endpoints
 *
 * Centralized data storage for gateway organizations.
 * Gateways are stateless - they push/pull data snapshots from here.
 *
 * Data includes:
 * - Yjs CRDT state for projects
 * - Permission configurations
 * - OAuth tokens
 * - Any other organization-specific runtime state
 */

import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { EPriority, log } from '@monorepo/log';
import {
  authenticateOrganizationToken,
  OrganizationAuthRequest,
  authenticateJwt,
} from '../../middleware/auth';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';
import { pg } from '../../database/pg';

/**
 * Get data directory path for environment
 */
function getDataDir(): string {
  const envName = process.env.ENVIRONMENT_NAME || 'dev-001';
  return `/root/.local-dev/${envName}/org-data`;
}

/**
 * Get organization data file path
 */
function getOrgDataPath(orgId: string): string {
  return path.join(getDataDir(), `${orgId}.json`);
}

export const setupGatewayDataRoutes = (router: Router) => {
  /**
   * Push organization data snapshot from gateway
   * POST /gateway/data/push
   *
   * Gateway calls this on:
   * - Auto-save (e.g., every 5 minutes)
   * - Shutdown (graceful or triggered by deallocation)
   * - Manual save trigger
   *
   * Body:
   * {
   *   "organization_id": "uuid",
   *   "gateway_id": "uuid",
   *   "timestamp": "ISO8601",
   *   "data": {
   *     "yjs_state": { ... },
   *     "permissions": { ... },
   *     "oauth_tokens": { ... },
   *     "projects": { ... }
   *   }
   * }
   */
  router.post(
    '/gateway/data/push',
    authenticateOrganizationToken,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      const { timestamp, data } = req.body;

      // Get org_id and gateway_id from token
      const organization_id = req.organization.id;
      const gateway_id = req.organization.gateway_id;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: data',
        });
      }

      log(
        6,
        'GATEWAY_DATA',
        `Push from gateway ${gateway_id} for org ${organization_id}`
      );

      try {
        // Ensure data directory exists
        const dataDir = getDataDir();
        await fs.promises.mkdir(dataDir, { recursive: true });

        // Prepare data package
        const dataPackage = {
          organization_id,
          gateway_id,
          timestamp: timestamp || new Date().toISOString(),
          stored_at: new Date().toISOString(),
          data,
        };

        // Write to file (atomic write via temp file + rename)
        const dataPath = getOrgDataPath(organization_id);
        const tempPath = `${dataPath}.tmp`;

        await fs.promises.writeFile(
          tempPath,
          JSON.stringify(dataPackage, null, 2),
          'utf-8'
        );

        await fs.promises.rename(tempPath, dataPath);

        const stats = await fs.promises.stat(dataPath);

        log(
          6,
          'GATEWAY_DATA',
          `✅ Data stored for org ${organization_id} (${stats.size} bytes)`
        );

        return res.json({
          success: true,
          stored_at: dataPackage.stored_at,
          size_bytes: stats.size,
        });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DATA',
          `Failed to push data for org ${organization_id}:`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: 'Failed to store data',
          details: error.message,
        });
      }
    })
  );

  /**
   * Pull organization data snapshot to gateway
   * POST /gateway/data/pull
   *
   * Gateway calls this on:
   * - Allocation to an organization (after handshake)
   * - Restart/recovery
   *
   * Body:
   * {
   *   "organization_id": "uuid",
   *   "gateway_id": "uuid"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "data": { ... },
   *   "timestamp": "ISO8601",
   *   "exists": true
   * }
   */
  router.post(
    '/gateway/data/pull',
    authenticateOrganizationToken,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      // Get org_id and gateway_id from token
      const organization_id = req.organization.id;
      const gateway_id = req.organization.gateway_id;

      log(
        6,
        'GATEWAY_DATA',
        `Pull requested by gateway ${gateway_id} for org ${organization_id}`
      );

      try {
        const dataPath = getOrgDataPath(organization_id);

        // Check if data exists
        try {
          await fs.promises.access(dataPath, fs.constants.R_OK);
        } catch {
          log(
            6,
            'GATEWAY_DATA',
            `No existing data for org ${organization_id} (new org or first allocation)`
          );
          return res.json({
            success: true,
            exists: false,
            data: null,
            timestamp: null,
          });
        }

        // Read data
        const content = await fs.promises.readFile(dataPath, 'utf-8');
        const dataPackage = JSON.parse(content);

        log(
          6,
          'GATEWAY_DATA',
          `✅ Data retrieved for org ${organization_id} (stored: ${dataPackage.stored_at})`
        );

        return res.json({
          success: true,
          exists: true,
          data: dataPackage.data,
          timestamp: dataPackage.timestamp,
          stored_at: dataPackage.stored_at,
        });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DATA',
          `Failed to pull data for org ${organization_id}:`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: 'Failed to retrieve data',
          details: error.message,
        });
      }
    })
  );

  /**
   * Delete organization data
   * DELETE /gateway/data/:organization_id
   *
   * Called when an organization is permanently deleted.
   * Requires organization owner authentication.
   */
  router.delete(
    '/gateway/data/:organization_id',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organization_id } = req.params;

      // Check user is organization owner
      const roleCheck = await pg.query(
        'SELECT func_user_get_org_role($1, $2) as role',
        [req.user.id, String(organization_id)]
      );
      const role = roleCheck.next()?.oneRow()['role'] as string | null;
      if (role !== 'owner') {
        // Check if organization exists for better error message
        const orgResult = await pg.query(
          'SELECT 1 FROM organizations WHERE organization_id = $1',
          [organization_id]
        );
        if (!orgResult.next()?.oneRow()) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        return res
          .status(403)
          .json({
            error: 'Only organization owner can delete organization data',
          });
      }

      log(6, 'GATEWAY_DATA', `Delete requested for org ${organization_id}`);

      try {
        const dataPath = getOrgDataPath(organization_id);

        // Check if file exists
        try {
          await fs.promises.access(dataPath, fs.constants.F_OK);
        } catch {
          log(6, 'GATEWAY_DATA', `No data file for org ${organization_id}`);
          return res.json({
            success: true,
            message: 'No data to delete',
          });
        }

        // Delete file
        await fs.promises.unlink(dataPath);

        log(6, 'GATEWAY_DATA', `✅ Data deleted for org ${organization_id}`);

        return res.json({
          success: true,
          message: 'Data deleted',
        });
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_DATA',
          `Failed to delete data for org ${organization_id}:`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: 'Failed to delete data',
          details: error.message,
        });
      }
    })
  );
};
