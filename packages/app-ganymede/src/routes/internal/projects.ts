import { Router, Request, RequestHandler } from 'express';
import { authenticateGatewayToken } from '../../middleware/gateway-auth';
import { pg } from '../../database/pg';
import { asyncHandler } from '../../middleware/route-handler';
import { EPriority, log } from '@holistix-forge/log';

/**
 * Internal Project Routes
 * 
 * These routes are ONLY callable by gateway (not frontend).
 * Protected by gateway token authentication.
 * 
 * Used for gateway-orchestrated member management to maintain
 * consistency between gateway state and Ganymede database.
 */
export const setupInternalProjectRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /internal/projects/:project_id/members
   * Add member to project (Gateway-only)
   * 
   * This route is ONLY callable by gateway (not frontend).
   * Gateway manages roles, this just updates projects_members table.
   */
  router.post(
    '/internal/projects/:project_id/members',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id required' });
      }

      log(
        EPriority.Info,
        'INTERNAL_API',
        `Adding member ${user_id} to project ${req.params.project_id}`
      );

      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        user_id,
        true, // add = true
      ]);

      return res.json({ success: true });
    })
  );

  /**
   * DELETE /internal/projects/:project_id/members/:user_id
   * Remove member from project (Gateway-only)
   * 
   * This route is ONLY callable by gateway (not frontend).
   * Gateway manages roles, this just updates projects_members table.
   */
  router.delete(
    '/internal/projects/:project_id/members/:user_id',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      log(
        EPriority.Info,
        'INTERNAL_API',
        `Removing member ${req.params.user_id} from project ${req.params.project_id}`
      );

      await pg.query('CALL proc_projects_members_edit($1, $2, $3)', [
        req.params.project_id,
        req.params.user_id,
        false, // add = false
      ]);

      return res.json({ success: true });
    })
  );
};
