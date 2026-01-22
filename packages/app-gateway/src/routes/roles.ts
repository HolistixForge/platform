import { Router, Request, RequestHandler } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { requirePermission } from '../middleware/permissions';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { EPriority, log, ForbiddenException, NotFoundException } from '@holistix-forge/log';

/**
 * Role Management Routes
 * 
 * CRUD operations for roles and user-role assignments.
 */
export const setupRolesRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * GET /roles
   * List all roles (system + custom)
   * Requires: gateway:roles:read
   */
  router.get(
    '/roles',
    authenticateJwt,
    requirePermission('gateway:roles:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const roles = instances.roleManager.getAllRoles();
      return res.json({ roles });
    })
  );

  /**
   * GET /roles/:role_id
   * Get role by ID
   * Requires: gateway:roles:read
   */
  router.get(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:roles:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        throw new NotFoundException([{ message: 'Role not found' }]);
      }

      return res.json(role);
    })
  );

  /**
   * POST /roles
   * Create custom role
   * Body: { role_name, display_name, description, permissions, scope }
   * Requires: gateway:roles:write
   */
  router.post(
    '/roles',
    authenticateJwt,
    requirePermission('gateway:roles:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { role_name, display_name, description, permissions, scope } =
        req.body;

      // Validation
      if (!role_name || !display_name || !permissions || !scope) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['role_name', 'display_name', 'permissions', 'scope'],
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be array' });
      }

      if (!['org', 'project'].includes(scope)) {
        return res.status(400).json({ error: 'scope must be org or project' });
      }

      log(
        EPriority.Info,
        'ROLES',
        `Creating role: ${role_name} (scope: ${scope})`
      );

      // Create role
      const role_id = instances.roleManager.createRole({
        role_name,
        display_name,
        description: description || '',
        permissions,
        scope,
        immutable: false,
        system: false,
      });

      const role = instances.roleManager.getRole(role_id);
      return res.status(201).json(role);
    })
  );

  /**
   * PATCH /roles/:role_id
   * Update custom role
   * Body: { display_name?, description?, permissions? }
   * Requires: gateway:roles:write
   */
  router.patch(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:roles:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        throw new NotFoundException([{ message: 'Role not found' }]);
      }

      if (role.immutable) {
        throw new ForbiddenException([
          {
            message: `Cannot modify system role: ${role.role_name}`,
          },
        ]);
      }

      const { display_name, description, permissions } = req.body;

      log(
        EPriority.Info,
        'ROLES',
        `Updating role: ${role.role_name}`
      );

      instances.roleManager.updateRole(req.params.role_id, {
        display_name,
        description,
        permissions,
      });

      const updated = instances.roleManager.getRole(req.params.role_id);
      return res.json(updated);
    })
  );

  /**
   * DELETE /roles/:role_id
   * Delete custom role
   * Requires: gateway:roles:write
   */
  router.delete(
    '/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:roles:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const role = instances.roleManager.getRole(req.params.role_id);
      if (!role) {
        throw new NotFoundException([{ message: 'Role not found' }]);
      }

      if (role.immutable) {
        throw new ForbiddenException([
          {
            message: `Cannot delete system role: ${role.role_name}`,
          },
        ]);
      }

      log(
        EPriority.Info,
        'ROLES',
        `Deleting role: ${role.role_name}`
      );

      // Remove role from all users first
      instances.userRoleManager.removeRoleFromAllUsers(req.params.role_id);

      // Delete role
      instances.roleManager.deleteRole(req.params.role_id);

      return res.json({ success: true });
    })
  );

  /**
   * GET /users/:user_id/roles
   * Get user's roles (org + project-specific)
   * Query: ?project_id=<uuid> (optional, to include project roles)
   * Requires: gateway:roles:read
   */
  router.get(
    '/users/:user_id/roles',
    authenticateJwt,
    requirePermission('gateway:roles:read'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { user_id } = req.params;
      const { project_id } = req.query;

      const orgRoles = instances.userRoleManager.getUserOrgRoles(user_id);

      const projectRoles: Record<string, any[]> = project_id
        ? {
            [project_id as string]: instances.userRoleManager.getUserProjectRoles(
              user_id,
              project_id as string
            ),
          }
        : {};

      return res.json({
        org_roles: orgRoles,
        project_roles: projectRoles,
      });
    })
  );

  /**
   * POST /users/:user_id/roles
   * Assign role to user
   * Body: { role_id: string, scope: 'org' | 'project', project_id?: string }
   * Requires: gateway:roles:write
   */
  router.post(
    '/users/:user_id/roles',
    authenticateJwt,
    requirePermission('gateway:roles:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { user_id } = req.params;
      const { role_id, scope, project_id } = req.body;

      // Validation
      if (!role_id || !scope) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['role_id', 'scope'],
        });
      }

      if (scope === 'project' && !project_id) {
        return res.status(400).json({
          error: 'project_id required for project-scoped role',
        });
      }

      // Check role exists
      const role = instances.roleManager.getRole(role_id);
      if (!role) {
        throw new NotFoundException([{ message: 'Role not found' }]);
      }

      log(
        EPriority.Info,
        'ROLES',
        `Assigning role ${role.role_name} to user ${user_id} (scope: ${scope})`
      );

      // Assign role
      if (scope === 'org') {
        if (role.scope !== 'org') {
          throw new ForbiddenException([
            {
              message: `Role "${role.role_name}" is not org-scoped (scope: ${role.scope})`,
            },
          ]);
        }
        instances.userRoleManager.assignOrgRole(user_id, role_id);
      } else {
        if (role.scope !== 'project') {
          throw new ForbiddenException([
            {
              message: `Role "${role.role_name}" is not project-scoped (scope: ${role.scope})`,
            },
          ]);
        }
        instances.userRoleManager.assignProjectRole(user_id, project_id, role_id);
      }

      return res.json({ success: true });
    })
  );

  /**
   * DELETE /users/:user_id/roles/:role_id
   * Remove role from user
   * Query: ?project_id=<uuid> (required for project-scoped roles)
   * Requires: gateway:roles:write
   */
  router.delete(
    '/users/:user_id/roles/:role_id',
    authenticateJwt,
    requirePermission('gateway:roles:write'),
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { user_id, role_id } = req.params;
      const { project_id } = req.query;

      const role = instances.roleManager.getRole(role_id);
      if (!role) {
        throw new NotFoundException([{ message: 'Role not found' }]);
      }

      log(
        EPriority.Info,
        'ROLES',
        `Removing role ${role.role_name} from user ${user_id}`
      );

      if (role.scope === 'org') {
        instances.userRoleManager.removeOrgRole(user_id, role_id);
      } else {
        if (!project_id) {
          return res.status(400).json({
            error: 'project_id required for project-scoped role',
          });
        }
        instances.userRoleManager.removeProjectRole(
          user_id,
          project_id as string,
          role_id
        );
      }

      return res.json({ success: true });
    })
  );
};
