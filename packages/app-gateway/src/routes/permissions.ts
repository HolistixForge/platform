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
   * DEPRECATED - Use /users/:user_id/roles instead
   * 
   * GET /permissions/projects/:project_id
   * Get user permissions for a project (not compatible with RBAC)
   * 
   * ⚠️ This route is deprecated. Permissions are now resolved via roles.
   * Use GET /users/:user_id/roles?project_id=:project_id instead.
   */
  router.get(
    '/permissions/projects/:project_id',
    authenticateJwt,
    requirePermission('gateway:[permissions:*]:read'),
    requireProjectAccess(),
    asyncHandler(async (req: Request, res) => {
      return res.status(410).json({
        error: 'This endpoint is deprecated',
        message: 'Permissions are now managed via roles in RBAC system',
        alternatives: {
          'Get user roles': 'GET /users/:user_id/roles?project_id=:project_id',
          'List all roles': 'GET /roles',
        },
      });
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

