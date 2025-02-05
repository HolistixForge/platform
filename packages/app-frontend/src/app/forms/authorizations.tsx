import {
  useCollaborators,
  useMutationUserScope,
  useQueryScope,
  useQueryUsersSearch,
} from '@monorepo/demiurge-data';
import {
  UsersScopes,
  UsersScopesLogicProps,
  UsersScopesProps,
} from '@monorepo/demiurge-ui-components';
import { useCallback, useState } from 'react';
import { useProject } from '../pages/project/editor/node-editor/nodes/projects';
import { TCollaborator, TF_User } from '@monorepo/demiurge-types';

//

export const useServerScopeEditorProps = (
  project_id: string,
): UsersScopesLogicProps => {
  //

  const { collaborators, loading: collaboratorsLoading } =
    useCollaborators(project_id);

  //

  const [searched, setSearched] = useState('');
  const d = useQueryUsersSearch(searched);

  const onSearch = useCallback((s: string) => {
    setSearched(s);
  }, []);

  //

  const shareUnshare = useMutationUserScope(project_id);

  const onValidateUser = useCallback(
    (c: TCollaborator) => {
      return shareUnshare
        .mutateAsync({ user_id: c.user_id, scope: c.scope })
        .then(() => {
          return;
        });
    },
    [shareUnshare],
  );

  const onDelete = useCallback(
    (u: TF_User) => onValidateUser({ ...u, scope: [], is_owner: false }),
    [onValidateUser],
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

export const AuthorizationsFormLogic = () => {
  const p = useProject();
  const logic = useServerScopeEditorProps(p.project.project_id);

  const { status: scopeStatus, data: scopeData } = useQueryScope();
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
