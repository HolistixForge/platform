import { getGatewayInstances } from '../initialization/gateway-instances';
import { RequestData } from '@holistix-forge/reducers';
import { ForbiddenException, NotFoundException, EPriority, log } from '@holistix-forge/log';

/**
 * Member management events
 * 
 * These events orchestrate project member add/remove operations:
 * 1. Validate requester has permission
 * 2. Update gateway state (assign/remove roles)
 * 3. Call Ganymede internal API to persist to database
 * 4. Gateway state autosave handles persistence
 */

export type MemberAddEvent = {
  type: 'member:add';
  project_id: string;
  user_id: string;
  role_ids: string[];  // Roles to assign
};

export type MemberRemoveEvent = {
  type: 'member:remove';
  project_id: string;
  user_id: string;
};

/**
 * Handle member:add event
 * 
 * Adds a user to a project with specified roles.
 * 
 * Validation:
 * - Requester must have project:*:admin permission
 * - User must be organization member
 * - Roles must exist and be project-scoped
 * 
 * Actions:
 * - Assign roles in gateway state
 * - Call Ganymede internal API to add to projects_members table
 * 
 * @param event - member:add event
 * @param requestData - Request context (includes requester user_id)
 */
export async function handleMemberAdd(
  event: MemberAddEvent,
  requestData: RequestData
): Promise<void> {
  const { project_id, user_id, role_ids } = event;
  const instances = getGatewayInstances();

  if (!instances) {
    throw new Error('Gateway instances not initialized');
  }

  log(
    EPriority.Info,
    'MEMBER_EVENTS',
    `Handling member:add - project: ${project_id}, user: ${user_id}, roles: ${role_ids.join(', ')}`
  );

  // 1. Validate: Requester has permission to manage project members
  const hasPermission = instances.permissionManager.hasPermission(
    requestData.user_id,
    `project:${project_id}:admin`,
    project_id
  );

  if (!hasPermission) {
    throw new ForbiddenException([
      { message: 'Permission denied: project:admin required to add members' },
    ]);
  }

  // 2. Validate: User is organization member (fetch fresh list)
  const orgMembers = await instances.gatewayState.fetchOrganizationMembers();
  const isMember = orgMembers.some((m) => m.user_id === user_id);

  if (!isMember) {
    throw new ForbiddenException([
      { message: 'User must be organization member before adding to project' },
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
      'MEMBER_EVENTS',
      `Assigned role "${role?.role_name}" to user ${user_id} for project ${project_id}`
    );
  }

  // 5. Call Ganymede internal API to add to projects_members table
  const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
  const gatewayToken = process.env.GATEWAY_TOKEN;

  if (!gatewayToken) {
    throw new Error('GATEWAY_TOKEN not configured');
  }

  log(
    EPriority.Debug,
    'MEMBER_EVENTS',
    `Calling Ganymede internal API: POST /internal/projects/${project_id}/members`
  );

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
      `Failed to add member in Ganymede: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  log(
    EPriority.Info,
    'MEMBER_EVENTS',
    `✅ Successfully added member ${user_id} to project ${project_id}`
  );

  // Gateway state autosave will persist role assignments
}

/**
 * Handle member:remove event
 * 
 * Removes a user from a project (removes all project roles).
 * 
 * Validation:
 * - Requester must have project:*:admin permission
 * 
 * Actions:
 * - Remove all project roles from user in gateway state
 * - Call Ganymede internal API to remove from projects_members table
 * 
 * @param event - member:remove event
 * @param requestData - Request context (includes requester user_id)
 */
export async function handleMemberRemove(
  event: MemberRemoveEvent,
  requestData: RequestData
): Promise<void> {
  const { project_id, user_id } = event;
  const instances = getGatewayInstances();

  if (!instances) {
    throw new Error('Gateway instances not initialized');
  }

  log(
    EPriority.Info,
    'MEMBER_EVENTS',
    `Handling member:remove - project: ${project_id}, user: ${user_id}`
  );

  // 1. Validate: Requester has permission to manage project members
  const hasPermission = instances.permissionManager.hasPermission(
    requestData.user_id,
    `project:${project_id}:admin`,
    project_id
  );

  if (!hasPermission) {
    throw new ForbiddenException([
      { message: 'Permission denied: project:admin required to remove members' },
    ]);
  }

  // 2. Remove all project roles for user
  instances.userRoleManager.removeAllProjectRoles(user_id, project_id);

  log(
    EPriority.Info,
    'MEMBER_EVENTS',
    `Removed all project roles for user ${user_id} on project ${project_id}`
  );

  // 3. Call Ganymede internal API to remove from projects_members table
  const ganymedeUrl = process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
  const gatewayToken = process.env.GATEWAY_TOKEN;

  if (!gatewayToken) {
    throw new Error('GATEWAY_TOKEN not configured');
  }

  log(
    EPriority.Debug,
    'MEMBER_EVENTS',
    `Calling Ganymede internal API: DELETE /internal/projects/${project_id}/members/${user_id}`
  );

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
      `Failed to remove member in Ganymede: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  log(
    EPriority.Info,
    'MEMBER_EVENTS',
    `✅ Successfully removed member ${user_id} from project ${project_id}`
  );

  // Gateway state autosave will persist role changes
}
