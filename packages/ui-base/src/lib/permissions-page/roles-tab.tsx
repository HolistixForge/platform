import { RoleEditor, Role, RoleEditorProps } from '../role-editor/role-editor';

export interface RolesTabProps {
  roles: Role[];
  loading: boolean;
  readonly?: boolean;
  onCreateRole: RoleEditorProps['onCreateRole'];
  onUpdateRole: RoleEditorProps['onUpdateRole'];
  onDeleteRole: RoleEditorProps['onDeleteRole'];
}

export const RolesTab = ({
  roles,
  loading,
  readonly = false,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: RolesTabProps) => {
  return (
    <div className="roles-tab">
      <RoleEditor
        roles={roles}
        loading={loading}
        readonly={readonly}
        onCreateRole={onCreateRole}
        onUpdateRole={onUpdateRole}
        onDeleteRole={onDeleteRole}
      />
    </div>
  );
};
