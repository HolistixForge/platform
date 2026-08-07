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
import { EPriority, log } from '@holistix-forge/log';
import {
  authenticateJwtOrganization,
  OrganizationAuthRequest,
  authenticateJwtUser,
} from '../../middleware/auth';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';
import { pg } from '../../database/pg';

/**
 * Get data directory path for environment
 */
function getDataDir(): string {
  const envName = process.env.ENV_NAME || 'dev-001';
  return `/root/.local-dev/${envName}/org-data`;
}

/**
 * Get organization data file path
 * Validates orgId to prevent path traversal attacks
 */
function getOrgDataPath(orgId: string): string {
  // Validate orgId format (UUID)
  if (!/^[a-f0-9-]{36}$/.test(orgId)) {
    throw new Error(`Invalid organization ID format: ${orgId}`);
  }

  const dataPath = path.join(getDataDir(), `${orgId}.json`);

  // Additional security: ensure resolved path is within data directory
  const resolvedPath = path.resolve(dataPath);
  const resolvedDataDir = path.resolve(getDataDir());

  if (!resolvedPath.startsWith(resolvedDataDir)) {
    throw new Error('Path traversal attempt detected');
  }

  return dataPath;
}

/**
 * Take over what an older Ganymede left in a file.
 *
 * Runs once per organization, on the first pull that finds nothing in the
 * database, and writes what it finds back through the same table as any save.
 * The file is left where it is: reading it again is harmless once a row exists,
 * and deleting the only copy of a project's state during a migration is not a
 * risk worth taking for tidiness.
 *
 * Returns null when there is no file, which is the ordinary case for a new
 * organization and for every deployment after the first run.
 */
async function migrateOrgDataFile(orgId: string): Promise<{
  data: unknown;
  timestamp: string | null;
  stored_at: string | null;
} | null> {
  let content: string;
  try {
    content = await fs.promises.readFile(getOrgDataPath(orgId), 'utf-8');
  } catch {
    return null;
  }

  // `data` typed as the query layer wants it: this is a document whose shape
  // the collaborative engine owns, and the file it comes from has no schema to
  // check it against — the only honest claim is that it is JSON.
  let pkg: {
    data?: Record<string, unknown>;
    timestamp?: string;
    stored_at?: string;
  };
  try {
    pkg = JSON.parse(content);
  } catch (error) {
    // A truncated file is exactly what the old write could leave behind, and
    // it is worth saying out loud rather than treating as "no state".
    log(
      EPriority.Error,
      'GATEWAY_DATA',
      `Data file for org ${orgId} could not be parsed and was not migrated`,
      error
    );
    return null;
  }

  if (!pkg.data) return null;

  await pg.query(
    `INSERT INTO organization_state (organization_id, gateway_id, data, saved_at, updated_at)
     VALUES ($1, NULL, $2, $3, now())
     ON CONFLICT (organization_id) DO NOTHING`,
    [orgId, pkg.data as never, pkg.timestamp ?? null]
  );

  return {
    data: pkg.data,
    timestamp: pkg.timestamp ?? null,
    stored_at: pkg.stored_at ?? null,
  };
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
    authenticateJwtOrganization,
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
        EPriority.Info,
        'GATEWAY_DATA',
        `Push from gateway ${gateway_id} for org ${organization_id}`
      );

      try {
        const stored_at = new Date().toISOString();

        // In the database, not in a file.
        //
        // It was `/root/.local-dev/{env}/org-data/{org}.json`, which survives
        // only while Ganymede is a process on the platform host. Where it runs
        // in a container — macOS today — the path is inside that container, so
        // recreating it destroyed every node, edge and position the projects
        // had. Measured twice in one day, with all the services still running
        // and the whiteboard knowing nothing of them.
        //
        // One statement, so a save is whole or not at all: the file version
        // wrote a temporary copy and renamed it, which is atomic on one host
        // and says nothing about two gateways writing at once.
        const result = await pg.query(
          `INSERT INTO organization_state (organization_id, gateway_id, data, saved_at, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (organization_id) DO UPDATE
             SET gateway_id = EXCLUDED.gateway_id,
                 data = EXCLUDED.data,
                 saved_at = EXCLUDED.saved_at,
                 updated_at = now()
           RETURNING octet_length(data::text) AS size_bytes`,
          [organization_id, gateway_id, data, timestamp || stored_at]
        );

        const size_bytes = Number(result.next()?.oneRow()['size_bytes'] ?? 0);

        log(
          EPriority.Info,
          'GATEWAY_DATA',
          `✅ Data stored for org ${organization_id} (${size_bytes} bytes)`
        );

        return res.json({
          success: true,
          stored_at,
          size_bytes,
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
    authenticateJwtOrganization,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      // Get org_id and gateway_id from token
      const organization_id = req.organization.id;
      const gateway_id = req.organization.gateway_id;

      log(
        EPriority.Info,
        'GATEWAY_DATA',
        `Pull requested by gateway ${gateway_id} for org ${organization_id}`
      );

      try {
        const stored = await pg.query(
          `SELECT data, saved_at, updated_at
             FROM organization_state
            WHERE organization_id = $1`,
          [organization_id]
        );

        // The file left behind by an older Ganymede.
        //
        // Read once, on the first pull that finds nothing in the database, and
        // written back through the same path as any other save. Without it the
        // move to a table is indistinguishable from the loss it exists to
        // prevent: every project that had state would come back empty.
        const row = stored.next()?.oneRow();

        if (!row) {
          const migrated = await migrateOrgDataFile(organization_id);
          if (migrated) {
            log(
              EPriority.Notice,
              'GATEWAY_DATA',
              `Migrated org ${organization_id} from its data file into the database`
            );
            return res.json({
              success: true,
              exists: true,
              data: migrated.data,
              timestamp: migrated.timestamp,
              stored_at: migrated.stored_at,
            });
          }

          log(
            EPriority.Info,
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

        log(
          EPriority.Info,
          'GATEWAY_DATA',
          `✅ Data retrieved for org ${organization_id} (stored: ${row['updated_at']})`
        );

        return res.json({
          success: true,
          exists: true,
          data: row['data'],
          timestamp: row['saved_at'],
          stored_at: row['updated_at'],
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
    authenticateJwtUser,
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
        return res.status(403).json({
          error: 'Only organization owner can delete organization data',
        });
      }

      log(
        EPriority.Info,
        'GATEWAY_DATA',
        `Delete requested for org ${organization_id}`
      );

      try {
        const dataPath = getOrgDataPath(organization_id);

        // Check if file exists
        try {
          await fs.promises.access(dataPath, fs.constants.F_OK);
        } catch {
          log(
            EPriority.Info,
            'GATEWAY_DATA',
            `No data file for org ${organization_id}`
          );
          return res.json({
            success: true,
            message: 'No data to delete',
          });
        }

        // Delete file
        await fs.promises.unlink(dataPath);

        log(
          EPriority.Info,
          'GATEWAY_DATA',
          `✅ Data deleted for org ${organization_id}`
        );

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
