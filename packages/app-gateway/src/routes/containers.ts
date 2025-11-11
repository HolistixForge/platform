import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { containerTokenManager } from '../containers';
import { requirePermission } from '../middleware/permissions';
import { log } from '@monorepo/log';

const router = Router();

/**
 * Generate container token (called when container starts)
 * POST /containers/:container_id/token
 * Body: { project_id: string }
 *
 * Requires: container:create permission for the project
 */
router.post(
  '/:container_id/token',
  requirePermission('container:create'), // TODO: Future: Make project-specific (e.g., project:{id}:container:create)
  asyncHandler(async (req: any, res: Response) => {
    const { container_id } = req.params;
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Check if token already exists
    const existingToken = containerTokenManager.getToken(container_id);
    if (existingToken) {
      log(
        6,
        'CONTAINERS',
        `Returning existing token for container: ${container_id}`
      );
      return res.json({ token: existingToken });
    }

    // Generate new token
    const token = containerTokenManager.generateToken(container_id, project_id);

    log(6, 'CONTAINERS', `Generated token for container: ${container_id}`);

    return res.json({ token });
  })
);

/**
 * Validate container token (middleware use)
 * POST /containers/validate-token
 * Body: { token: string }
 *
 * Returns container_id and project_id if valid
 */
router.post(
  '/validate-token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const validated = containerTokenManager.validateToken(token);

    if (!validated) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    return res.json({
      container_id: validated.container_id,
      project_id: validated.project_id,
    });
  })
);

/**
 * Revoke container token (called when container is destroyed)
 * DELETE /containers/:container_id/token
 *
 * Note: This is for cleanup, called automatically by container lifecycle
 */
router.delete(
  '/:container_id/token',
  requirePermission('container:delete'), // TODO: Future: Make project-specific
  asyncHandler(async (req: Request, res: Response) => {
    const { container_id } = req.params;

    containerTokenManager.revokeToken(container_id);

    log(6, 'CONTAINERS', `Revoked token for container: ${container_id}`);

    return res.json({ success: true });
  })
);

/**
 * List container tokens (admin/debug)
 * GET /containers/tokens?project_id=...
 */
router.get(
  '/tokens',
  requirePermission('org:admin'), // Only org admins can list all tokens
  asyncHandler(async (req: Request, res: Response) => {
    const { project_id } = req.query;

    const tokens = containerTokenManager.listTokens(
      project_id ? String(project_id) : undefined
    );

    return res.json({ tokens });
  })
);

export default router;
