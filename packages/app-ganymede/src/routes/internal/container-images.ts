import { Router, Request, RequestHandler } from 'express';
import { authenticateGatewayToken } from '../../middleware/gateway-auth';
import { asyncHandler } from '../../middleware/route-handler';
import { EPriority, log } from '@holistix-forge/log';
import { CONFIG } from '../../config';
import {
  resolveForBroker,
  UnknownProjectImage,
  NoGithubLink,
  ProjectImageError,
} from '../../services/project-images';

/**
 * Internal container image routes.
 *
 * Called by the container broker, which runs on the platform host and is given
 * an `image_id` by a gateway. The broker resolves it here rather than trusting
 * the gateway with an image URI: the gateway is the tenant-facing process, and
 * "which image runs on the platform" must not be something it can decide.
 */
export const setupInternalContainerImageRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /internal/projects/:project_id/images/:image_id
   *
   * Returns the digest-pinned reference plus a GHCR token good for pulling
   * that one repository, for minutes. The project's GitHub App installation
   * never leaves this process, and no tenant credential is stored to begin
   * with — the token is minted on demand from the platform's own App key.
   */
  router.get(
    '/internal/projects/:project_id/images/:image_id',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      const { project_id, image_id } = req.params;

      if (!CONFIG.GITHUB_APP_ID || !CONFIG.GITHUB_APP_PRIVATE_KEY) {
        log(
          EPriority.Error,
          'CONTAINER_IMAGES',
          'GitHub App is not configured; no project image can be resolved'
        );
        return res
          .status(503)
          .json({ error: 'GitHub App is not configured on this deployment' });
      }

      try {
        const resolved = await resolveForBroker(project_id, image_id, {
          appId: CONFIG.GITHUB_APP_ID,
          privateKey: CONFIG.GITHUB_APP_PRIVATE_KEY,
        });

        log(
          EPriority.Info,
          'CONTAINER_IMAGES',
          `Resolved ${image_id} for project ${project_id}`,
          { reference: resolved.reference }
        );

        return res.json(resolved);
      } catch (e) {
        // 404 for "not in this project's catalog", so an image belonging to
        // another project is indistinguishable from one that does not exist.
        if (e instanceof UnknownProjectImage) {
          return res.status(404).json({ error: e.message });
        }
        if (e instanceof NoGithubLink) {
          return res.status(409).json({ error: e.message });
        }
        if (e instanceof ProjectImageError) {
          log(EPriority.Warning, 'CONTAINER_IMAGES', e.message);
          return res.status(403).json({ error: e.message });
        }
        // A GitHub outage is not the caller's fault and not a permission
        // problem; saying so keeps the broker from caching a wrong conclusion.
        log(
          EPriority.Error,
          'CONTAINER_IMAGES',
          `Could not resolve ${image_id}: ${String(e)}`
        );
        return res.status(502).json({ error: 'could not reach GitHub' });
      }
    })
  );
};
