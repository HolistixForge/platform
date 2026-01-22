import type { Meta, StoryObj } from '@storybook/react';
import { RoleEditor, RoleEditorProps, Role } from './role-editor';
import { useState, useCallback } from 'react';

const mockRoles: Role[] = [
  {
    role_id: '1',
    role_name: 'org:owner',
    display_name: 'Organization Owner',
    description: 'Full access to everything',
    permissions: ['*'],
    scope: 'org',
    system: true,
    immutable: true,
  },
  {
    role_id: '2',
    role_name: 'org:admin',
    display_name: 'Organization Admin',
    description: 'Administrative access',
    permissions: ['org:*:admin', 'project:*:create', 'project:*:admin'],
    scope: 'org',
    system: true,
    immutable: true,
  },
  {
    role_id: '3',
    role_name: 'project-developer',
    display_name: 'Project Developer',
    description: 'Can read and write projects',
    permissions: ['project:*:read', 'project:*:write', 'container:*:create'],
    scope: 'project',
    system: false,
    immutable: false,
  },
  {
    role_id: '4',
    role_name: 'project-viewer',
    display_name: 'Project Viewer',
    description: 'Read-only access to projects',
    permissions: ['project:*:read'],
    scope: 'project',
    system: false,
    immutable: false,
  },
];

const Wrap = (props: Omit<RoleEditorProps, 'roles' | 'loading' | 'onCreateRole' | 'onUpdateRole' | 'onDeleteRole'>) => {
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [loading, setLoading] = useState(false);

  const onCreateRole = useCallback(async (role: Omit<Role, 'role_id' | 'system' | 'immutable'>) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newRole: Role = {
      ...role,
      role_id: String(Date.now()),
      system: false,
      immutable: false,
    };
    setRoles(prev => [...prev, newRole]);
    setLoading(false);
  }, []);

  const onUpdateRole = useCallback(async (roleId: string, updates: Partial<Pick<Role, 'display_name' | 'description' | 'permissions'>>) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRoles(prev => prev.map(r => r.role_id === roleId ? { ...r, ...updates } : r));
    setLoading(false);
  }, []);

  const onDeleteRole = useCallback(async (roleId: string) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRoles(prev => prev.filter(r => r.role_id !== roleId));
    setLoading(false);
  }, []);

  return (
    <div style={{ padding: '50px' }}>
      <div style={{ height: '600px' }}>
        <RoleEditor
          {...props}
          roles={roles}
          loading={loading}
          onCreateRole={onCreateRole}
          onUpdateRole={onUpdateRole}
          onDeleteRole={onDeleteRole}
        />
      </div>
    </div>
  );
};

const meta: Meta<typeof Wrap> = {
  component: Wrap,
  title: 'Users/RoleEditor',
};

export default meta;
type Story = StoryObj<typeof Wrap>;

export const Primary: Story = {
  args: {
    readonly: false,
  },
};

export const ReadOnly: Story = {
  args: {
    readonly: true,
  },
};
