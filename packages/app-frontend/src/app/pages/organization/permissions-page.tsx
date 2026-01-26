import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PermissionsPage } from '@holistix-forge/ui-base';
import {
  useQueryRoles,
  useQueryOrgMembers,
  useQueryUserRoles,
  useMutationCreateRole,
  useMutationUpdateRole,
  useMutationDeleteRole,
  useMutationAssignRole,
  useMutationRemoveRole,
  Role,
  UserRoleAssignment,
} from '@holistix-forge/frontend-data';

export const OrganizationPermissionsPage = () => {
  const { organization_id } = useParams<{ organization_id: string }>();

  if (!organization_id) {
    return (
      <div style={{ padding: '2rem', color: '#ef4444' }}>
        Error: Organization ID is required
      </div>
    );
  }

  // Fetch data
  const rolesQuery = useQueryRoles(organization_id);
  const membersQuery = useQueryOrgMembers(organization_id);

  // Fetch all user roles (for all members)
  const memberIds = membersQuery.data?.members.map((m) => m.user_id) || [];
  
  // For now, we'll fetch user roles on-demand when a user is selected
  // In a production app, you might want to batch-fetch or cache these
  // We'll create a simple map structure
  const userRolesMap: { [user_id: string]: UserRoleAssignment } = useMemo(() => {
    const map: { [user_id: string]: UserRoleAssignment } = {};
    // Initialize empty assignments for all members
    memberIds.forEach((user_id) => {
      map[user_id] = {
        user_id,
        org_roles: [],
        project_roles: {},
      };
    });
    return map;
  }, [memberIds]);

  // Mutations
  const createRoleMutation = useMutationCreateRole(organization_id);
  const updateRoleMutation = useMutationUpdateRole(organization_id);
  const deleteRoleMutation = useMutationDeleteRole(organization_id);
  const assignRoleMutation = useMutationAssignRole(organization_id);
  const removeRoleMutation = useMutationRemoveRole(organization_id);

  const handleCreateRole = async (
    role: Omit<Role, 'role_id' | 'system' | 'immutable'>
  ) => {
    await createRoleMutation.mutateAsync(role);
  };

  const handleUpdateRole = async (
    roleId: string,
    updates: Partial<Pick<Role, 'display_name' | 'description' | 'permissions'>>
  ) => {
    await updateRoleMutation.mutateAsync({ role_id: roleId, updates });
  };

  const handleDeleteRole = async (roleId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this role? It will be removed from all users.'
      )
    ) {
      return;
    }
    await deleteRoleMutation.mutateAsync(roleId);
  };

  const handleAssignRole = async (
    user_id: string,
    role_id: string,
    scope: 'org' | 'project',
    project_id?: string
  ) => {
    await assignRoleMutation.mutateAsync({ user_id, role_id, scope, project_id });
    
    // Update local map (optimistic update will be handled by react-query)
    if (userRolesMap[user_id]) {
      const role = rolesQuery.data?.roles.find((r) => r.role_id === role_id);
      if (role) {
        if (scope === 'org') {
          userRolesMap[user_id].org_roles.push(role);
        } else if (project_id) {
          if (!userRolesMap[user_id].project_roles[project_id]) {
            userRolesMap[user_id].project_roles[project_id] = [];
          }
          userRolesMap[user_id].project_roles[project_id].push(role);
        }
      }
    }
  };

  const handleRemoveRole = async (
    user_id: string,
    role_id: string,
    project_id?: string
  ) => {
    await removeRoleMutation.mutateAsync({ user_id, role_id, project_id });
    
    // Update local map
    if (userRolesMap[user_id]) {
      if (!project_id) {
        userRolesMap[user_id].org_roles = userRolesMap[user_id].org_roles.filter(
          (r) => r.role_id !== role_id
        );
      } else if (userRolesMap[user_id].project_roles[project_id]) {
        userRolesMap[user_id].project_roles[project_id] = userRolesMap[user_id].project_roles[
          project_id
        ].filter((r) => r.role_id !== role_id);
      }
    }
  };

  const roles = rolesQuery.data?.roles || [];
  const members = membersQuery.data?.members || [];

  return (
    <PermissionsPage
      roles={roles}
      rolesLoading={rolesQuery.isLoading}
      members={members}
      membersLoading={membersQuery.isLoading}
      userRoles={userRolesMap}
      userRolesLoading={false}
      readonly={false}
      onCreateRole={handleCreateRole}
      onUpdateRole={handleUpdateRole}
      onDeleteRole={handleDeleteRole}
      onAssignRole={handleAssignRole}
      onRemoveRole={handleRemoveRole}
    />
  );
};
