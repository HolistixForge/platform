import { Router, Request, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { EPriority, log } from '@holistix-forge/log';
import type { SharedMap } from '@holistix-forge/collab-engine';
import type { TJsonObject } from '@holistix-forge/simple-types';

/**
 * Container Access Verification Routes
 *
 * Used by auth guard proxies inside user containers to verify
 * that a user has permission to access a specific container.
 *
 * Provides a "can this user access this container?" check.
 */
export const setupContainerAccessRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /containers/:containerId/verify-access
   *
   * Auth: JWT (Bearer token from auth guard)
   * Returns: { allowed: bool, user: { id, username, display_name } }
   *
   * The auth guard calls this after exchanging an OAuth code for a JWT.
   * Gateway checks RBAC: org:owner, org:admin, or project member.
   */
  router.post(
    '/containers/:containerId/verify-access',
    authenticateJwt,
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { containerId } = req.params;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authReq = req as any;
      const userId = authReq.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in JWT' });
      }

      // Find the container in shared state (across all projects)
      let containerProjectId: string | undefined;

      const { projectRooms, collabRegistry } = instances;
      const projectIds = projectRooms.getAllProjectIds();

      for (const projectId of projectIds) {
        try {
          const collab = collabRegistry.getCollabForProject(projectId);
          const containers = collab.sharedData['user-containers:containers'] as
            | SharedMap<TJsonObject>
            | undefined;
          if (containers && containers.get(containerId)) {
            containerProjectId = projectId;
            break;
          }
        } catch {
          // Project may not have user-containers data yet
          continue;
        }
      }

      if (!containerProjectId) {
        log(
          EPriority.Debug,
          'CONTAINER_ACCESS',
          `Container ${containerId} not found`
        );
        return res.status(404).json({ error: 'Container not found' });
      }

      // Check permission: org:owner OR org:admin OR project member
      const { permissionManager } = instances;
      const hasAccess =
        permissionManager.hasPermission(userId, 'org:owner') ||
        permissionManager.hasPermission(userId, 'org:admin') ||
        permissionManager.hasPermission(
          userId,
          `project:${containerProjectId}:member`
        ) ||
        permissionManager.hasPermission(
          userId,
          `project:${containerProjectId}:admin`
        );

      if (!hasAccess) {
        log(
          EPriority.Info,
          'CONTAINER_ACCESS',
          `Access denied for user ${userId} to container ${containerId}`
        );
        return res.json({ allowed: false });
      }

      // Get user info from JWT
      const jwtPayload = authReq.jwt;
      const username = jwtPayload?.user?.username || '';

      log(
        EPriority.Debug,
        'CONTAINER_ACCESS',
        `Access granted for user ${userId} to container ${containerId}`
      );

      return res.json({
        allowed: true,
        user: {
          id: userId,
          username,
          display_name: username,
        },
      });
    })
  );
};
