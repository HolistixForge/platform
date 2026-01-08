import { Router, RequestHandler } from 'express';
import { authenticateJwtUser } from '../../middleware/auth';
import { pg } from '../../database/pg';
import { asyncHandler, AuthRequest } from '../../middleware/route-handler';
import {
  encryptCredential,
  decryptCredential,
  CURRENT_KEY_VERSION,
} from '../../services/credentials-encryption';

/**
 * Credentials Wallet API Routes
 *
 * Manages user credentials for third-party service integrations.
 * All credentials are encrypted at rest using AES-256-GCM.
 */

export const setupCredentialRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // =========================================================================
  // GET /credentials/types - List available credential types
  // =========================================================================
  router.get(
    '/credentials/types',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const result = await pg.query(
        `SELECT 
          credential_type, 
          display_name, 
          description, 
          icon_url, 
          validation_schema, 
          required_fields,
          module_name
        FROM credential_metadata
        ORDER BY display_name`,
        []
      );

      const types = result.next()?.allRows() || [];
      return res.json({ types });
    })
  );

  // =========================================================================
  // POST /credentials/types - Register a new credential type (internal/module use)
  // =========================================================================
  router.post(
    '/credentials/types',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const {
        credential_type,
        display_name,
        description,
        icon_url,
        validation_schema,
        required_fields,
        module_name,
      } = req.body;

      await pg.query(
        `INSERT INTO credential_metadata (
          credential_type, display_name, description, icon_url, 
          validation_schema, required_fields, module_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (credential_type) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          icon_url = EXCLUDED.icon_url,
          validation_schema = EXCLUDED.validation_schema,
          required_fields = EXCLUDED.required_fields,
          module_name = EXCLUDED.module_name,
          updated_at = CURRENT_TIMESTAMP`,
        [
          credential_type,
          display_name,
          description || null,
          icon_url || null,
          validation_schema ? JSON.stringify(validation_schema) : null,
          required_fields ? JSON.stringify(required_fields) : '[]',
          module_name,
        ]
      );

      return res.status(201).json({ success: true });
    })
  );

  // =========================================================================
  // GET /credentials - List user's credentials (and shared credentials)
  // =========================================================================
  router.get(
    '/credentials',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { type, organization_id, project_id, resource_id, include_shared } =
        req.query;

      // Build query for user's own credentials
      let query = `
        SELECT 
          c.id as credential_id,
          c.user_id,
          c.credential_type,
          c.name,
          c.metadata,
          c.created_at,
          c.updated_at,
          c.last_used_at,
          FALSE as is_shared,
          NULL::varchar as share_scope
        FROM credentials c
        WHERE c.user_id = $1 AND c.is_active = true
      `;
      const params: (string | null | boolean)[] = [userId];
      let paramIndex = 2;

      if (type) {
        query += ` AND c.credential_type = $${paramIndex}`;
        params.push(type as string);
        paramIndex++;
      }

      // If include_shared is true, also fetch shared credentials
      if (include_shared === 'true') {
        query += `
          UNION ALL
          SELECT 
            c.id as credential_id,
            c.user_id,
            c.credential_type,
            c.name,
            c.metadata,
            c.created_at,
            c.updated_at,
            c.last_used_at,
            TRUE as is_shared,
            cs.share_scope
          FROM credentials c
          INNER JOIN credential_shares cs ON c.id = cs.credential_id
          WHERE c.is_active = true 
            AND cs.is_active = true
            AND c.user_id != $1
        `;

        // Add filters for shared credentials based on scope
        if (organization_id) {
          query += ` AND (cs.share_scope = 'organization' AND cs.organization_id = $${paramIndex})`;
          params.push(organization_id as string);
          paramIndex++;
        }
        if (project_id) {
          query += ` AND (cs.share_scope = 'project' AND cs.project_id = $${paramIndex})`;
          params.push(project_id as string);
          paramIndex++;
        }
        if (resource_id) {
          query += ` AND (cs.share_scope = 'resource' AND cs.resource_id = $${paramIndex})`;
          params.push(resource_id as string);
          paramIndex++;
        }

        if (type) {
          query += ` AND c.credential_type = $${paramIndex}`;
          params.push(type as string);
        }
      }

      query += ' ORDER BY created_at DESC';

      const result = await pg.query(query, params);
      const credentials = result.next()?.allRows() || [];

      return res.json({ credentials });
    })
  );

  // =========================================================================
  // GET /credentials/:credential_id - Get credential with decrypted value
  // =========================================================================
  router.get(
    '/credentials/:credential_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;

      // Check ownership or share access
      const result = await pg.query(
        `SELECT 
          c.id as credential_id,
          c.user_id,
          c.credential_type,
          c.name,
          c.encrypted_value,
          c.encryption_key_id,
          c.metadata,
          c.created_at,
          c.updated_at,
          c.last_used_at
        FROM credentials c
        WHERE c.id = $1 
          AND c.is_active = true
          AND (
            c.user_id = $2
            OR EXISTS (
              SELECT 1 FROM credential_shares cs
              WHERE cs.credential_id = c.id
                AND cs.is_active = true
                AND (
                  (cs.share_scope = 'organization' AND EXISTS (
                    SELECT 1 FROM organizations_members om 
                    WHERE om.organization_id = cs.organization_id 
                      AND om.user_id = $2
                  ))
                  OR (cs.share_scope = 'project' AND EXISTS (
                    SELECT 1 FROM projects_members pm 
                    WHERE pm.project_id = cs.project_id 
                      AND pm.user_id = $2
                  ))
                )
            )
          )`,
        [credential_id, userId]
      );

      const row = result.next()?.oneRow();
      if (!row) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Decrypt the value (iv is embedded in encrypted_value)
      const decryptedValue = decryptCredential(
        row['encrypted_value'] as string,
        row['encryption_key_id'] as string
      );

      // Update last_used_at
      await pg.query(
        `UPDATE credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [credential_id]
      );

      const credential = {
        credential_id: row['credential_id'],
        user_id: row['user_id'],
        credential_type: row['credential_type'],
        name: row['name'],
        value: decryptedValue,
        metadata: row['metadata'] || {},
        created_at: row['created_at'],
        updated_at: row['updated_at'],
        last_used_at: row['last_used_at'],
      };

      return res.json({ credential });
    })
  );

  // =========================================================================
  // POST /credentials - Create a new credential
  // =========================================================================
  router.post(
    '/credentials',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_type, name, value, metadata } = req.body;

      // Verify credential type exists
      const typeCheck = await pg.query(
        `SELECT credential_type FROM credential_metadata WHERE credential_type = $1`,
        [credential_type]
      );
      if (!typeCheck.next()?.oneRow()) {
        return res.status(400).json({ error: 'Invalid credential type' });
      }

      // Encrypt the credential value
      const encryptedValue = encryptCredential(value);

      // Insert credential
      const result = await pg.query(
        `INSERT INTO credentials (
          user_id, credential_type, name, encrypted_value, 
          encryption_key_id, iv, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id as credential_id, created_at, updated_at`,
        [
          userId,
          credential_type,
          name,
          encryptedValue,
          CURRENT_KEY_VERSION,
          'embedded', // IV is embedded in encrypted_value
          metadata ? JSON.stringify(metadata) : '{}',
        ]
      );

      const row = result.next()?.oneRow();
      if (!row) {
        return res.status(500).json({ error: 'Failed to create credential' });
      }

      const credential = {
        credential_id: row['credential_id'],
        user_id: userId,
        credential_type,
        name,
        metadata: metadata || {},
        created_at: row['created_at'],
        updated_at: row['updated_at'],
        last_used_at: null,
      };

      return res.status(201).json({ credential });
    })
  );

  // =========================================================================
  // PATCH /credentials/:credential_id - Update a credential
  // =========================================================================
  router.patch(
    '/credentials/:credential_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;
      const { name, value, metadata, is_active } = req.body;

      // Verify ownership
      const ownerCheck = await pg.query(
        `SELECT id FROM credentials WHERE id = $1 AND user_id = $2`,
        [credential_id, userId]
      );
      if (!ownerCheck.next()?.oneRow()) {
        return res
          .status(404)
          .json({ error: 'Credential not found or not owned by user' });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: (string | boolean | null)[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }
      if (value !== undefined) {
        const encryptedValue = encryptCredential(value);
        updates.push(`encrypted_value = $${paramIndex}`);
        params.push(encryptedValue);
        paramIndex++;
        updates.push(`encryption_key_id = $${paramIndex}`);
        params.push(CURRENT_KEY_VERSION);
        paramIndex++;
      }
      if (metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}`);
        params.push(JSON.stringify(metadata));
        paramIndex++;
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(credential_id);

      await pg.query(
        `UPDATE credentials SET ${updates.join(
          ', '
        )} WHERE id = $${paramIndex}`,
        params
      );

      return res.json({ success: true });
    })
  );

  // =========================================================================
  // DELETE /credentials/:credential_id - Soft delete a credential
  // =========================================================================
  router.delete(
    '/credentials/:credential_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;

      // Verify ownership and soft delete
      const result = await pg.query(
        `UPDATE credentials 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND user_id = $2
        RETURNING id as credential_id`,
        [credential_id, userId]
      );

      if (!result.next()?.oneRow()) {
        return res
          .status(404)
          .json({ error: 'Credential not found or not owned by user' });
      }

      // Also deactivate all shares
      await pg.query(
        `UPDATE credential_shares 
        SET is_active = false, revoked_at = CURRENT_TIMESTAMP 
        WHERE credential_id = $1`,
        [credential_id]
      );

      return res.json({ success: true });
    })
  );

  // =========================================================================
  // POST /credentials/:credential_id/share - Share a credential
  // =========================================================================
  router.post(
    '/credentials/:credential_id/share',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;
      const { share_scope, organization_id, project_id, resource_id } =
        req.body;

      // Verify ownership
      const ownerCheck = await pg.query(
        `SELECT id FROM credentials WHERE id = $1 AND user_id = $2 AND is_active = true`,
        [credential_id, userId]
      );
      if (!ownerCheck.next()?.oneRow()) {
        return res
          .status(404)
          .json({ error: 'Credential not found or not owned by user' });
      }

      // Validate share scope and required IDs
      if (share_scope === 'organization' && !organization_id) {
        return res
          .status(400)
          .json({ error: 'organization_id required for organization scope' });
      }
      if (share_scope === 'project' && !project_id) {
        return res
          .status(400)
          .json({ error: 'project_id required for project scope' });
      }
      if (share_scope === 'resource' && !resource_id) {
        return res
          .status(400)
          .json({ error: 'resource_id required for resource scope' });
      }

      // Verify user has access to the organization/project they're sharing to
      if (share_scope === 'organization') {
        const memberCheck = await pg.query(
          `SELECT 1 FROM organizations_members WHERE organization_id = $1 AND user_id = $2`,
          [organization_id, userId]
        );
        if (!memberCheck.next()?.oneRow()) {
          return res
            .status(403)
            .json({ error: 'Not a member of the organization' });
        }
      }
      if (share_scope === 'project') {
        const memberCheck = await pg.query(
          `SELECT 1 FROM projects_members WHERE project_id = $1 AND user_id = $2`,
          [project_id, userId]
        );
        if (!memberCheck.next()?.oneRow()) {
          return res.status(403).json({ error: 'Not a member of the project' });
        }
      }

      // Create the share
      const result = await pg.query(
        `INSERT INTO credential_shares (
          credential_id, share_scope, organization_id, project_id, resource_id, granted_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id as share_id, granted_at`,
        [
          credential_id,
          share_scope,
          organization_id || null,
          project_id || null,
          resource_id || null,
          userId,
        ]
      );

      const row = result.next()?.oneRow();
      if (!row) {
        return res.status(500).json({ error: 'Failed to create share' });
      }

      return res.status(201).json({
        share: {
          share_id: row['share_id'],
          credential_id,
          share_scope,
          organization_id: organization_id || null,
          project_id: project_id || null,
          resource_id: resource_id || null,
          granted_at: row['granted_at'],
        },
      });
    })
  );

  // =========================================================================
  // GET /credentials/:credential_id/shares - List shares for a credential
  // =========================================================================
  router.get(
    '/credentials/:credential_id/shares',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;

      // Verify ownership
      const ownerCheck = await pg.query(
        `SELECT id FROM credentials WHERE id = $1 AND user_id = $2`,
        [credential_id, userId]
      );
      if (!ownerCheck.next()?.oneRow()) {
        return res
          .status(404)
          .json({ error: 'Credential not found or not owned by user' });
      }

      const result = await pg.query(
        `SELECT 
          id as share_id, credential_id, share_scope, 
          organization_id, project_id, resource_id,
          granted_by, granted_at, revoked_at, is_active
        FROM credential_shares 
        WHERE credential_id = $1
        ORDER BY granted_at DESC`,
        [credential_id]
      );

      const shares = result.next()?.allRows() || [];
      return res.json({ shares });
    })
  );

  // =========================================================================
  // DELETE /credentials/:credential_id/shares/:share_id - Revoke a share
  // =========================================================================
  router.delete(
    '/credentials/:credential_id/shares/:share_id',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id, share_id } = req.params;

      // Verify ownership of the credential
      const ownerCheck = await pg.query(
        `SELECT id FROM credentials WHERE id = $1 AND user_id = $2`,
        [credential_id, userId]
      );
      if (!ownerCheck.next()?.oneRow()) {
        return res
          .status(404)
          .json({ error: 'Credential not found or not owned by user' });
      }

      // Revoke the share
      const result = await pg.query(
        `UPDATE credential_shares 
        SET is_active = false, revoked_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND credential_id = $2
        RETURNING id as share_id`,
        [share_id, credential_id]
      );

      if (!result.next()?.oneRow()) {
        return res.status(404).json({ error: 'Share not found' });
      }

      return res.json({ success: true });
    })
  );

  // =========================================================================
  // POST /credentials/:credential_id/validate - Validate a credential
  // =========================================================================
  router.post(
    '/credentials/:credential_id/validate',
    authenticateJwtUser,
    asyncHandler(async (req: AuthRequest, res) => {
      const userId = req.user.id;
      const { credential_id } = req.params;

      // Verify ownership or share access
      const result = await pg.query(
        `SELECT 
          c.credential_type,
          c.encrypted_value,
          c.encryption_key_id
        FROM credentials c
        WHERE c.id = $1 
          AND c.is_active = true
          AND (
            c.user_id = $2
            OR EXISTS (
              SELECT 1 FROM credential_shares cs
              WHERE cs.credential_id = c.id AND cs.is_active = true
            )
          )`,
        [credential_id, userId]
      );

      const row = result.next()?.oneRow();
      if (!row) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // For now, just verify we can decrypt it
      // In the future, implement per-type validation (e.g., API ping)
      try {
        decryptCredential(
          row['encrypted_value'] as string,
          row['encryption_key_id'] as string
        );
        return res.json({
          valid: true,
          message: 'Credential decryption successful',
        });
      } catch {
        return res.json({
          valid: false,
          message: 'Credential decryption failed',
        });
      }
    })
  );
};
