import type { Role } from './user-role-editor';
import type { OrgMember, UserRoleAssignment } from './users-tab';

/**
 * Deterministic fixtures shared by the permissions-page stories.
 * Kept static (no random ids, no `Date.now()`) so the visual regression
 * snapshots stay stable.
 */

export const mockRoles: Role[] = [
  {
    role_id: 'role-owner',
    role_name: 'org:owner',
    display_name: 'Organization Owner',
    description: 'Full access to everything',
    permissions: ['*'],
    scope: 'org',
    system: true,
    immutable: true,
  },
  {
    role_id: 'role-admin',
    role_name: 'org:admin',
    display_name: 'Organization Admin',
    description: 'Administrative access',
    permissions: ['org:*:admin', 'project:*:create', 'project:*:admin'],
    scope: 'org',
    system: true,
    immutable: true,
  },
  {
    role_id: 'role-developer',
    role_name: 'project-developer',
    display_name: 'Project Developer',
    description: 'Can read and write projects',
    permissions: ['project:*:read', 'project:*:write', 'container:*:create'],
    scope: 'project',
    system: false,
    immutable: false,
  },
  {
    role_id: 'role-viewer',
    role_name: 'project-viewer',
    display_name: 'Project Viewer',
    description: 'Read-only access to projects',
    permissions: ['project:*:read'],
    scope: 'project',
    system: false,
    immutable: false,
  },
];

export const mockMembers: OrgMember[] = [
  {
    user_id: 'user-1',
    username: 'claude-test',
    email: 'claude@test.local',
    added_at: '2026-01-05T09:00:00.000Z',
  },
  {
    user_id: 'user-2',
    username: 'alice',
    email: 'alice@example.com',
    added_at: '2026-01-12T09:00:00.000Z',
  },
  {
    user_id: 'user-3',
    username: 'bob',
    email: 'bob@example.com',
    added_at: '2026-01-20T09:00:00.000Z',
  },
];

export const mockUserRoles: { [user_id: string]: UserRoleAssignment } = {
  'user-1': {
    user_id: 'user-1',
    org_roles: [mockRoles[0]],
    project_roles: {},
  },
  'user-2': {
    user_id: 'user-2',
    org_roles: [mockRoles[1]],
    project_roles: { 'proj-1': [mockRoles[2]] },
  },
  'user-3': {
    user_id: 'user-3',
    org_roles: [],
    project_roles: { 'proj-1': [mockRoles[3]] },
  },
};
