import { Router, RequestHandler } from 'express';
import { EPriority, log } from '@holistix-forge/log';

import {
  authenticateJwtOrganization,
  OrganizationAuthRequest,
} from '../../middleware/auth';
import { asyncHandler } from '../../middleware/route-handler';
import { pg } from '../../database/pg';

/**
 * Opting a machine into a project.
 *
 * Called by a gateway when a placement is made on a local runner. The gateway
 * knows which machine and which project; it does not get to decide whether the
 * grant is legitimate. That check — only the machine's own owner may make the
 * first placement on it — happens against the runners table, inside the
 * statement, because collab state is not where a permission should be settled.
 *
 * Organization-authenticated, like every other internal route, and the project
 * is verified to belong to that organization before anything is written. A
 * gateway holds one organization's rooms and has no business opting a machine
 * into another organization's project.
 */
export const setupInternalRunnerProjectRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /internal/runners/:runner_id/projects
   *
   * Idempotent: a placement is made every time someone starts a service, and
   * only the first one is an event.
   */
  router.post(
    '/internal/runners/:runner_id/projects',
    authenticateJwtOrganization,
    asyncHandler(async (req: OrganizationAuthRequest, res) => {
      const { project_id, user_id } = req.body ?? {};
      const { runner_id } = req.params;

      if (!project_id || !user_id) {
        return res
          .status(400)
          .json({ error: 'project_id and user_id are required' });
      }

      // The same check /gateway/tokens/scoped makes, for the same reason: a
      // gateway may only act within the organization it was allocated to.
      const owns = await pg.query(
        'SELECT 1 FROM projects WHERE project_id = $1 AND organization_id = $2',
        [project_id, req.organization.id]
      );
      if (!owns.next()?.oneRow()) {
        return res
          .status(403)
          .json({ error: 'Project does not belong to organization' });
      }

      const qr = await pg.query(
        'select * from func_runner_projects_add($1, $2, $3, $4)',
        [runner_id, project_id, req.organization.id, user_id]
      );

      if (!qr.next()?.oneRow()) {
        // Unknown runner, revoked runner, or a user who is not its owner —
        // deliberately one answer, so a refusal cannot be used to learn whose
        // machines exist.
        return res
          .status(403)
          .json({ error: 'Runner cannot be opted into this project' });
      }

      log(
        EPriority.Info,
        'RUNNER_PROJECTS',
        `Runner ${runner_id} opted into project ${project_id} by ${user_id}`
      );

      return res.json({ runner_id, project_id });
    })
  );
};
