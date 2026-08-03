import { CheckIcon, Cross2Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { ButtonBase } from '../buttons/buttonBase';
import { useAction } from '../buttons/useAction';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Popover from '@radix-ui/react-popover';

export interface Role {
  role_id: string;
  role_name: string;
  display_name: string;
  description: string;
  permissions: string[];
  scope: 'org' | 'project';
  system: boolean;
  immutable: boolean;
}

export interface UserRoleEditorProps {
  user_id: string;
  username: string;
  currentRoles: Role[];
  availableRoles: Role[];
  loading: boolean;
  readonly?: boolean;
  onAssignRole: (
    role_id: string,
    scope: 'org' | 'project',
    project_id?: string
  ) => Promise<void>;
  onRemoveRole: (role_id: string, project_id?: string) => Promise<void>;
}

const RoleBadge = ({
  role,
  onRemove,
  readonly,
}: {
  role: Role;
  onRemove?: () => void;
  readonly?: boolean;
}) => {
  const [showPermissions, setShowPermissions] = useState(false);

  return (
    <div className={`role-badge ${role.system ? 'system' : 'custom'}`}>
      <span className="role-name">{role.display_name}</span>
      {!readonly && onRemove && !role.immutable && (
        <button
          className="remove-btn"
          onClick={onRemove}
          title="Remove role"
          aria-label={`Remove ${role.display_name}`}
        >
          <Cross2Icon />
        </button>
      )}
      <Popover.Root open={showPermissions} onOpenChange={setShowPermissions}>
        <Popover.Trigger asChild>
          <button
            className="info-btn"
            aria-label={`View permissions for ${role.display_name}`}
          >
            <InfoCircledIcon />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="role-permissions-popover" sideOffset={5}>
            <div className="popover-header">
              <h4>{role.display_name}</h4>
              <p className="description">{role.description}</p>
            </div>
            <div className="permissions-list">
              <h5>Permissions ({role.permissions.length})</h5>
              <ScrollArea.Root className="scroll-area-root">
                <ScrollArea.Viewport className="scroll-area-viewport">
                  <ul>
                    {role.permissions.map((perm, idx) => (
                      <li key={idx}>
                        <CheckIcon className="check-icon" />
                        <code>{perm}</code>
                      </li>
                    ))}
                  </ul>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar
                  className="scroll-area-scrollbar"
                  orientation="vertical"
                >
                  <ScrollArea.Thumb className="scroll-area-thumb" />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>
            </div>
            <Popover.Arrow className="popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export const UserRoleEditor = ({
  user_id,
  username,
  currentRoles,
  availableRoles,
  loading,
  readonly = false,
  onAssignRole,
  onRemoveRole,
}: UserRoleEditorProps) => {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const assignAction = useAction(async () => {
    if (!selectedRoleId) return;
    const role = availableRoles.find((r) => r.role_id === selectedRoleId);
    if (!role) return;
    await onAssignRole(selectedRoleId, role.scope);
    setSelectedRoleId('');
  }, [selectedRoleId, onAssignRole, availableRoles]);

  // Filter out already assigned roles
  const assignableRoles = availableRoles.filter(
    (ar) => !currentRoles.some((cr) => cr.role_id === ar.role_id)
  );

  if (loading) {
    return (
      <div className="user-role-editor loading">
        <p>Loading roles...</p>
      </div>
    );
  }

  return (
    <div className="user-role-editor">
      <header>
        <h3>Edit Roles: {username}</h3>
        <p className="user-id-hint">User ID: {user_id}</p>
      </header>

      <section className="current-roles">
        <h4>Current Roles</h4>
        {currentRoles.length === 0 ? (
          <p className="empty-state">No roles assigned</p>
        ) : (
          <div className="role-badges">
            {currentRoles.map((role) => (
              <RoleBadge
                key={role.role_id}
                role={role}
                onRemove={
                  !readonly && !role.immutable
                    ? () => onRemoveRole(role.role_id)
                    : undefined
                }
                readonly={readonly}
              />
            ))}
          </div>
        )}
      </section>

      {!readonly && assignableRoles.length > 0 && (
        <section className="assign-role">
          <h4>Assign New Role</h4>
          <div className="assign-form">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={assignAction.loading}
            >
              <option value="">Select a role...</option>
              {assignableRoles.map((role) => (
                <option key={role.role_id} value={role.role_id}>
                  {role.display_name} ({role.scope})
                </option>
              ))}
            </select>
            <ButtonBase
              {...assignAction}
              text="Assign"
              disabled={!selectedRoleId || assignAction.loading}
              className="blue"
            />
          </div>
        </section>
      )}

      {!readonly && assignableRoles.length === 0 && currentRoles.length > 0 && (
        <p className="info-message">
          All available roles are already assigned.
        </p>
      )}
    </div>
  );
};
