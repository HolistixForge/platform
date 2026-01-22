import { Router, Request, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { requirePermission, requireProjectAccess } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';

/**
 * Setup permission-related routes
 */
export const setupPermissionsRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  // Note: Rate limiter is applied globally at app level for API routes
  // Individual endpoints use JWT authentication for access control
  /**
   * GET /permissions
   * Get all compiled permissions from all modules
   * Requires: gateway:[permissions:*]:read
   */
  router.get(
    '/permissions',
    authenticateJwt,
    requirePermission('gateway:[permissions:*]:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const permissions = instances.permissionRegistry.getAll();
      return res.json({ permissions });
    })
  );

  /**
   * GET /permissions/projects/:project_id
   * Get user permissions for a project
   * Requires: gateway:[permissions:*]:read + project access
   */
  router.get(
    '/permissions/projects/:project_id',
    authenticateJwt,
    requirePermission('gateway:[permissions:*]:read'),
    requireProjectAccess(), // Checks project access
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { project_id } = req.params;
      const permissionManager = instances.permissionManager;

      // Get all users with permissions for this project
      // PermissionManager stores permissions per user, so we need to filter
      // by project-related permissions
      const allPermissions = permissionManager.getAllPermissions();
      const projectPermissions: { [user_id: string]: string[] } = {};

      for (const [user_id, permissions] of Object.entries(allPermissions)) {
        const projectPerms = permissions.filter((p: string) =>
          p.includes(`project:${project_id}:`)
        );
        if (projectPerms.length > 0) {
          projectPermissions[user_id] = projectPerms;
        }
      }

      return res.json({ permissions: projectPermissions });
    })
  );

  /**
   * DEPRECATED - Use /roles and /users/:user_id/roles instead
   * 
   * PATCH /permissions/projects/:project_id/users/:user_id
   * Direct permission assignment (bypasses RBAC)
   * 
   * ⚠️ This route is deprecated. Use role-based assignment instead:
   * 1. Create/assign roles via POST /roles
   * 2. Assign roles to users via POST /users/:user_id/roles
   */
  router.patch(
    '/permissions/projects/:project_id/users/:user_id',
    authenticateJwt,
    requirePermission('gateway:[permissions:*]:write'),
    requireProjectAccess(),
    asyncHandler(async (req: Request, res) => {
      return res.status(410).json({
        error: 'This endpoint is deprecated',
        message: 'Use role-based permission management instead',
        alternatives: {
          'Create role': 'POST /roles',
          'Assign role': 'POST /users/:user_id/roles',
          'View user roles': 'GET /users/:user_id/roles',
        },
      });
    })
  );
};

