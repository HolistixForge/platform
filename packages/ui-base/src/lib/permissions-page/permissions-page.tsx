import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { RolesTab } from './roles-tab';
import { UsersTab, OrgMember, UserRoleAssignment } from './users-tab';
import { Role } from './user-role-editor';

import './permissions-page.scss';

export interface PermissionsPageProps {
  // Roles data
  roles: Role[];
  rolesLoading: boolean;

  // Members data
  members: OrgMember[];
  membersLoading: boolean;

  // User roles data
  userRoles: { [user_id: string]: UserRoleAssignment };
  userRolesLoading: boolean;

  // UI state
  readonly?: boolean;
  defaultTab?: 'roles' | 'users';

  // Role management callbacks
  onCreateRole: (
    role: Omit<Role, 'role_id' | 'system' | 'immutable'>
  ) => Promise<void>;
  onUpdateRole: (
    roleId: string,
    updates: Partial<Pick<Role, 'display_name' | 'description' | 'permissions'>>
  ) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;

  // User role assignment callbacks
  onAssignRole: (
    user_id: string,
    role_id: string,
    scope: 'org' | 'project',
    project_id?: string
  ) => Promise<void>;
  onRemoveRole: (
    user_id: string,
    role_id: string,
    project_id?: string
  ) => Promise<void>;
}

export const PermissionsPage = ({
  roles,
  rolesLoading,
  members,
  membersLoading,
  userRoles,
  userRolesLoading,
  readonly = false,
  defaultTab = 'roles',
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onAssignRole,
  onRemoveRole,
}: PermissionsPageProps) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  const getUserRoles = (user_id: string): Role[] => {
    const assignment = userRoles[user_id];
    if (!assignment) return [];
    // For now, only return org-level roles
    // Could extend to include project roles in the future
    return assignment.org_roles || [];
  };

  return (
    <div className="permissions-page">
      <header className="page-header">
        <h1>Organization Permissions</h1>
        <p className="subtitle">
          Manage roles and user access for your organization
        </p>
      </header>

      <Tabs.Root
        className="tabs-root"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <Tabs.List className="tabs-list">
          <Tabs.Trigger className="tabs-trigger" value="roles">
            Roles
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs-trigger" value="users">
            Users
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className="tabs-content" value="roles">
          <RolesTab
            roles={roles}
            loading={rolesLoading}
            readonly={readonly}
            onCreateRole={onCreateRole}
            onUpdateRole={onUpdateRole}
            onDeleteRole={onDeleteRole}
          />
        </Tabs.Content>

        <Tabs.Content className="tabs-content" value="users">
          <UsersTab
            members={members}
            membersLoading={membersLoading}
            roles={roles}
            rolesLoading={rolesLoading}
            getUserRoles={getUserRoles}
            readonly={readonly}
            onAssignRole={onAssignRole}
            onRemoveRole={onRemoveRole}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};
