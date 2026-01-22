import { Router, RequestHandler } from 'express';
import { asyncHandler, AuthRequest } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { EPriority, log, ForbiddenException, NotFoundException } from '@holistix-forge/log';

/**
 * Member Management Routes
 * 
 * Gateway-orchestrated project member management.
 * All member add/remove operations go through gateway to maintain consistency.
 */
export const setupMembersRoutes = (
  router: Router,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rateLimiter?: RequestHandler
) => {
  /**
   * POST /members/projects/:project_id/users
   * Add member to project with roles
   * 
   * Body: { user_id: string, role_ids: string[] }
   * Requires: project:*:admin permission
   */
  router.post(
    '/members/projects/:project_id/users',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      const { project_id } = req.params;
      const { user_id, role_ids } = req.body;

      if (!user_id || !role_ids || !Array.isArray(role_ids)) {
        return res.status(400).json({
          error: 'Missing or invalid fields',
          required: { user_id: 'string', role_ids: 'string[]' },
        });
      }

      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      log(
        EPriority.Info,
        'MEMBERS',
        `Add member request: project ${project_id}, user ${user_id}, roles: ${role_ids.join(', ')}`
      );

      // 1. Validate: Requester has permission
      const hasPermission = instances.permissionManager.hasPermission(
        req.user.id,
        `project:${project_id}:admin`,
        project_id
      );

      if (!hasPermission) {
        throw new ForbiddenException([
          { message: 'Permission denied: project:admin required' },
        ]);
      }

      // 2. Validate: User is organization member
      const orgMembers = await instances.gatewayState.fetchOrganizationMembers();
      const isMember = orgMembers.some((m) => m.user_id === user_id);

      if (!isMember) {
        throw new ForbiddenException([
          { message: 'User must be organization member first' },
        ]);
      }

      // 3. Validate: Roles exist and are project-scoped
      for (const role_id of role_ids) {
        const role = instances.roleManager.getRole(role_id);

        if (!role) {
          throw new NotFoundException([{ message: `Role not found: ${role_id}` }]);
        }

        if (role.scope !== 'project') {
          throw new ForbiddenException([
            {
              message: `Role "${role.role_name}" is not project-scoped (scope: ${role.scope})`,
            },
          ]);
        }
      }

      // 4. Assign roles in gateway state
      for (const role_id of role_ids) {
        instances.userRoleManager.assignProjectRole(user_id, project_id, role_id);

        const role = instances.roleManager.getRole(role_id);
        log(
          EPriority.Info,
          'MEMBERS',
          `Assigned role "${role?.role_name}" to user ${user_id}`
        );
      }

      // 5. Call Ganymede internal API
      const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
      const gatewayToken = process.env.GATEWAY_TOKEN;

      if (!gatewayToken) {
        throw new Error('GATEWAY_TOKEN not configured');
      }

      const response = await fetch(
        `${ganymedeUrl}/internal/projects/${project_id}/members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': gatewayToken,
          },
          body: JSON.stringify({ user_id }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to add member in Ganymede: ${response.status} - ${errorText}`
        );
      }

      log(
        EPriority.Info,
        'MEMBERS',
        `✅ Successfully added member ${user_id} to project ${project_id}`
      );

      return res.json({ success: true });
    })
  );

  /**
   * DELETE /members/projects/:project_id/users/:user_id
   * Remove member from project
   * 
   * Requires: project:*:admin permission
   */
  router.delete(
    '/members/projects/:project_id/users/:user_id',
    authenticateJwt,
    asyncHandler(async (req: AuthRequest, res) => {
      const { project_id, user_id } = req.params;

      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      log(
        EPriority.Info,
        'MEMBERS',
        `Remove member request: project ${project_id}, user ${user_id}`
      );

      // 1. Validate: Requester has permission
      const hasPermission = instances.permissionManager.hasPermission(
        req.user.id,
        `project:${project_id}:admin`,
        project_id
      );

      if (!hasPermission) {
        throw new ForbiddenException([
          { message: 'Permission denied: project:admin required' },
        ]);
      }

      // 2. Remove all project roles
      instances.userRoleManager.removeAllProjectRoles(user_id, project_id);

      log(
        EPriority.Info,
        'MEMBERS',
        `Removed all project roles for user ${user_id}`
      );

      // 3. Call Ganymede internal API
      const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
      const gatewayToken = process.env.GATEWAY_TOKEN;

      if (!gatewayToken) {
        throw new Error('GATEWAY_TOKEN not configured');
      }

      const response = await fetch(
        `${ganymedeUrl}/internal/projects/${project_id}/members/${user_id}`,
        {
          method: 'DELETE',
          headers: {
            'X-Gateway-Token': gatewayToken,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to remove member in Ganymede: ${response.status} - ${errorText}`
        );
      }

      log(
        EPriority.Info,
        'MEMBERS',
        `✅ Successfully removed member ${user_id} from project ${project_id}`
      );

      return res.json({ success: true });
    })
  );
};
