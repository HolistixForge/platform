import {
  useCollaborators,
  useMutationUserScope as useMutationUserPermissions,
  useQueryScope,
  useQueryUsersSearch,
} from '@holistix/frontend-data';
import {
  UsersScopes,
  UsersScopesLogicProps,
  UsersScopesProps,
} from '@holistix/ui-base';
import { useCallback, useState } from 'react';
import { useProject } from '../pages/project/project-context';
import { TCollaborator, TF_User } from '@holistix/demiurge-types';

//

export const usePermissionsEditorProps = (
  organization_id: string | null,
  project_id: string
): UsersScopesLogicProps => {
  //

  const { collaborators, loading: collaboratorsLoading } = useCollaborators(
    organization_id,
    project_id
  );

  //

  const [searched, setSearched] = useState('');
  const d = useQueryUsersSearch(searched);

  const onSearch = useCallback((s: string) => {
    setSearched(s);
  }, []);

  //

  const shareUnshare = useMutationUserPermissions(organization_id, project_id);

  const onValidateUser = useCallback(
    (c: TCollaborator) => {
      return shareUnshare
        .mutateAsync({ user_id: c.user_id, scope: c.scope })
        .then(() => {
          return;
        });
    },
    [shareUnshare]
  );

  const onDelete = useCallback(
    (u: TF_User) => onValidateUser({ ...u, scope: [], is_owner: false }),
    [onValidateUser]
  );

  return {
    collaborators,
    collaboratorsLoading,
    onSearch,
    onDelete,
    onValidateUser,
    searchResults: d.data || [],
    searchLoading: d.isFetching,
  };
};

//

export const PermissionsEditor = () => {
  const p = useProject();
  const logic = usePermissionsEditorProps(
    p.organization_id,
    p.project.project_id
  );

  const { status: scopeStatus, data: scopeData } = useQueryScope(
    p.organization_id
  );
  const scopes: UsersScopesProps['scopes'] = {};
  const scope = scopeStatus === 'success' ? scopeData : [];
  scope.forEach((s) => (scopes[s] = { title: s }));

  return (
    <div style={{ height: '800px', padding: '25px' }}>
      <UsersScopes
        columnWidth={300}
        avatarWidth={40}
        scopes={scopes}
        readonly={false}
        {...logic}
      />
    </div>
  );
};
