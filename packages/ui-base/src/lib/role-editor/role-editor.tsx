import * as Sa from '@radix-ui/react-scroll-area';
import { PlusIcon, TrashIcon, Pencil1Icon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { ButtonIcon } from '../buttons/buttonIcon';
import { ButtonBase } from '../buttons/buttonBase';
import { TextFieldset } from '../form/form-fields/text-fieldset';
import { useAction } from '../buttons/useAction';

import './role-editor.scss';

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

export interface RoleEditorProps {
  roles: Role[];
  loading: boolean;
  readonly?: boolean;
  onCreateRole: (role: Omit<Role, 'role_id' | 'system' | 'immutable'>) => Promise<void>;
  onUpdateRole: (roleId: string, updates: Partial<Pick<Role, 'display_name' | 'description' | 'permissions'>>) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
}

export const RoleEditor = ({
  roles,
  loading,
  readonly = false,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: RoleEditorProps) => {
  const [editMode, setEditMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editedRole, setEditedRole] = useState<Partial<Role> | null>(null);
  const [permissionInput, setPermissionInput] = useState('');

  const startCreate = () => {
    setEditMode('create');
    setEditedRole({
      role_name: '',
      display_name: '',
      description: '',
      permissions: [],
      scope: 'project',
    });
    setPermissionInput('');
  };

  const startEdit = (role: Role) => {
    if (role.immutable) return;
    setEditMode('edit');
    setEditedRole({ ...role });
    setPermissionInput('');
  };

  const cancelEdit = () => {
    setEditMode('none');
    setEditedRole(null);
    setPermissionInput('');
  };

  const saveAction = useAction(async () => {
    if (!editedRole) return;

    if (editMode === 'create') {
      await onCreateRole({
        role_name: editedRole.role_name!,
        display_name: editedRole.display_name!,
        description: editedRole.description || '',
        permissions: editedRole.permissions || [],
        scope: editedRole.scope || 'project',
      });
    } else if (editMode === 'edit' && editedRole.role_id) {
      await onUpdateRole(editedRole.role_id, {
        display_name: editedRole.display_name,
        description: editedRole.description,
        permissions: editedRole.permissions,
      });
    }

    cancelEdit();
  }, [editMode, editedRole, onCreateRole, onUpdateRole]);

  const deleteAction = useAction(async (roleId: string) => {
    await onDeleteRole(roleId);
  }, [onDeleteRole]);

  const addPermission = () => {
    if (!permissionInput.trim() || !editedRole) return;
    
    const newPermissions = [...(editedRole.permissions || []), permissionInput.trim()];
    setEditedRole({ ...editedRole, permissions: newPermissions });
    setPermissionInput('');
  };

  const removePermission = (permission: string) => {
    if (!editedRole) return;
    const newPermissions = editedRole.permissions?.filter(p => p !== permission) || [];
    setEditedRole({ ...editedRole, permissions: newPermissions });
  };

  return (
    <div className="role-editor">
      <div className="panel-roles">
        <div className="panel-header">
          <span className="panel-title">Roles</span>
          {!readonly && editMode === 'none' && (
            <ButtonIcon
              Icon={PlusIcon}
              callback={startCreate}
              className="blue"
            />
          )}
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <ButtonIcon loading={true} />
          </div>
        ) : (
          <Sa.Root className="ScrollAreaRoot">
            <Sa.Viewport className="ScrollAreaViewport">
              <div className="roles-list">
                {roles.map((role) => (
                  <div
                    key={role.role_id}
                    className={`role-item ${role.system ? 'system-role' : ''}`}
                    onClick={() => !role.immutable && startEdit(role)}
                  >
                    <div className="role-info">
                      <div className="role-name">
                        {role.display_name}
                        {role.system && <span className="badge">SYSTEM</span>}
                      </div>
                      <div className="role-scope">{role.scope}</div>
                      <div className="role-permissions-count">
                        {role.permissions.length} permissions
                      </div>
                    </div>
                    {!readonly && !role.immutable && (
                      <div className="role-actions">
                        <ButtonIcon
                          Icon={Pencil1Icon}
                          callback={() => startEdit(role)}
                          className="small"
                        />
                        <ButtonIcon
                          Icon={TrashIcon}
                          callback={() => deleteAction.callback(role.role_id)}
                          loading={deleteAction.loading}
                          className="red small"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Sa.Viewport>
            <Sa.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
              <Sa.Thumb className="ScrollAreaThumb" />
            </Sa.Scrollbar>
          </Sa.Root>
        )}
      </div>

      {editMode !== 'none' && editedRole && (
        <>
          <div className="separator"></div>
          <div className="panel-edit-role">
            <div className="panel-header">
              <span className="panel-title">
                {editMode === 'create' ? 'Create Role' : 'Edit Role'}
              </span>
              <div>
                <ButtonIcon
                  Icon={CheckIcon}
                  callback={saveAction.callback}
                  loading={saveAction.loading}
                  className="blue"
                />
                <ButtonIcon
                  Icon={Cross2Icon}
                  callback={cancelEdit}
                  className="red"
                />
              </div>
            </div>

            <Sa.Root className="ScrollAreaRoot">
              <Sa.Viewport className="ScrollAreaViewport">
                <div className="edit-form">
                  {editMode === 'create' && (
                    <TextFieldset
                      name="role_name"
                      label="Role Name (identifier)"
                      value={editedRole.role_name || ''}
                      onChange={(e) =>
                        setEditedRole({ ...editedRole, role_name: e.target.value })
                      }
                      placeholder="e.g. project-developer"
                    />
                  )}

                  <TextFieldset
                    name="display_name"
                    label="Display Name"
                    value={editedRole.display_name || ''}
                    onChange={(e) =>
                      setEditedRole({ ...editedRole, display_name: e.target.value })
                    }
                    placeholder="e.g. Project Developer"
                  />

                  <TextFieldset
                    name="description"
                    label="Description"
                    value={editedRole.description || ''}
                    onChange={(e) =>
                      setEditedRole({ ...editedRole, description: e.target.value })
                    }
                    placeholder="Role description"
                  />

                  {editMode === 'create' && (
                    <div className="field-group">
                      <label>Scope</label>
                      <select
                        value={editedRole.scope || 'project'}
                        onChange={(e) =>
                          setEditedRole({
                            ...editedRole,
                            scope: e.target.value as 'org' | 'project',
                          })
                        }
                      >
                        <option value="org">Organization</option>
                        <option value="project">Project</option>
                      </select>
                    </div>
                  )}

                  <div className="field-group">
                    <label>Permissions</label>
                    <div className="permission-input">
                      <input
                        type="text"
                        value={permissionInput}
                        onChange={(e) => setPermissionInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPermission()}
                        placeholder="e.g. project:*:write"
                      />
                      <ButtonBase
                        text="Add"
                        className="small blue"
                        callback={addPermission}
                      />
                    </div>
                    <div className="permissions-list">
                      {editedRole.permissions?.map((perm) => (
                        <div key={perm} className="permission-tag">
                          <code>{perm}</code>
                          <button
                            onClick={() => removePermission(perm)}
                            className="remove-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Sa.Viewport>
              <Sa.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
                <Sa.Thumb className="ScrollAreaThumb" />
              </Sa.Scrollbar>
            </Sa.Root>
          </div>
        </>
      )}
    </div>
  );
};
