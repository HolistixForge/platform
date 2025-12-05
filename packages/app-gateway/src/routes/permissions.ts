import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { requirePermission, requireProjectAccess } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';

/**
 * Setup permission-related routes
 */
export const setupPermissionsRoutes = (router: Router) => {
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
   * PATCH /permissions/projects/:project_id/users/:user_id
   * Update user permissions for a project
   * Requires: gateway:[permissions:*]:write + project access
   */
  router.patch(
    '/permissions/projects/:project_id/users/:user_id',
    authenticateJwt,
    requirePermission('gateway:[permissions:*]:write'),
    requireProjectAccess(), // Checks project access
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { project_id, user_id } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
      }

      const permissionManager = instances.permissionManager;

      // Validate permissions format
      const pattern =
        /^[a-z0-9-]+:\[([a-z0-9-]+:(?:\*|[a-z0-9-]+)(?:\/[a-z0-9-]+:(?:\*|[a-z0-9-]+))*)\]:[a-z0-9-]+$/;
      for (const perm of permissions) {
        if (typeof perm !== 'string' || !pattern.test(perm)) {
          return res.status(400).json({
            error: `Invalid permission format: ${perm}`,
          });
        }
      }

      // Get current permissions for user
      const currentPerms = permissionManager.getPermissions(user_id);

      // Remove old project-specific permissions
      const otherPerms = currentPerms.filter(
        (p: string) => !p.includes(`project:${project_id}:`)
      );

      // Add new permissions
      const newPerms = [...otherPerms, ...permissions];

      // Update permissions
      permissionManager.setPermissions(user_id, newPerms);

      return res.json({ success: true });
    })
  );
};

