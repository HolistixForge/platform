import { Router, Request, RequestHandler } from 'express';
import { authenticateGatewayToken } from '../../middleware/gateway-auth';
import { asyncHandler } from '../../middleware/route-handler';
import { EPriority, log } from '@holistix-forge/log';
import {
  allocateProjectNetwork,
  listProjectNetworks,
  NetworkAllocationError,
} from '../../services/project-networks';

/**
 * Internal private-network routes.
 *
 * Called by a gateway, which knows its organization and the project a
 * deployment belongs to but has no business choosing an address range: the /16
 * belongs to the organization, and a gateway only ever sees one project's
 * state. Allocation has to happen where the whole organization is visible and
 * where a unique constraint can settle a race.
 */
export const setupInternalProjectNetworkRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /internal/projects/:project_id/networks
   *
   * Everything a runner needs to be told about where it may place services.
   */
  router.get(
    '/internal/projects/:project_id/networks',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      const networks = await listProjectNetworks(req.params.project_id);
      return res.json({ networks });
    })
  );

  /**
   * POST /internal/projects/:project_id/networks
   *
   * Idempotent: declaring a network that already exists returns its range
   * rather than consuming a second one. A deployment that declares its networks
   * on every run is the normal case, not a mistake.
   */
  router.post(
    '/internal/projects/:project_id/networks',
    authenticateGatewayToken,
    asyncHandler(async (req: Request, res) => {
      const { organization_id, name, created_by } = req.body ?? {};

      if (!organization_id || !name) {
        return res
          .status(400)
          .json({ error: 'organization_id and name are required' });
      }

      try {
        const network = await allocateProjectNetwork(
          organization_id,
          req.params.project_id,
          name,
          created_by ?? null
        );

        log(
          EPriority.Info,
          'PROJECT_NETWORKS',
          `Network ${name} for project ${req.params.project_id} is ${network.cidr}`
        );

        return res.json(network);
      } catch (e) {
        if (e instanceof NetworkAllocationError) {
          // A malformed name and an exhausted space are both the caller's
          // problem to see, and neither is retryable by the gateway.
          log(EPriority.Warning, 'PROJECT_NETWORKS', e.message);
          return res.status(400).json({ error: e.message });
        }
        log(
          EPriority.Error,
          'PROJECT_NETWORKS',
          `Allocation failed for ${name}: ${String(e)}`
        );
        return res.status(500).json({ error: 'could not allocate a network' });
      }
    })
  );
};
