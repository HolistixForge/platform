import { useNavigate } from 'react-router-dom';
import {
  useCurrentUser,
  useMutationLogout,
  useQueriesUsers,
  useProject,
} from '@holistix-forge/frontend-data';
import { useAction } from '@holistix-forge/ui-base';
import { Header } from '@holistix-forge/ui-views';
import { useAwarenessUserList } from '@holistix-forge/collab/frontend';
import { TF_User, TG_User } from '@holistix-forge/types';

//

export const HeaderLogic = () => {
  const { data: me, status: meStatus } = useCurrentUser();

  const logout = useMutationLogout();

  const navigate = useNavigate();

  const logoutAction = useAction(() => {
    return logout.mutateAsync().then(() => navigate('/'));
  }, [logout, navigate]);

  // Always render Header - it will show login/signup buttons when user is not logged in
  const user = meStatus === 'success' && me?.user.user_id ? me.user : undefined;

  return (
    <Header
      user={user}
      logoutAction={user ? logoutAction : undefined}
      host
      share
      hasNotifications
    />
  );
};

//

export const HeaderLogicProject = () => {
  const { data: me, status: meStatus } = useCurrentUser();

  const logout = useMutationLogout();

  const navigate = useNavigate();

  const logoutAction = useAction(() => {
    return logout.mutateAsync().then(() => navigate('/'));
  }, [logout, navigate]);

  const users = useAwarenessUserList();

  // Get organization_id from project context for permissions link
  const { organization_id } = useProject();
  const permissionsLink = `/org/${organization_id}/permissions`;

  // Filter out guest user ID before fetching user details
  // The guest user ID is used as a fallback in collab config and should not be fetched
  const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';
  const validUserIds = users
    .map((u) => u.user_id)
    .filter((id) => id !== GUEST_USER_ID);

  // queries for each needed user
  const usersQueries = useQueriesUsers(validUserIds);

  const otherUsers: TF_User[] = usersQueries
    .filter(
      (u) =>
        u.status === 'success' &&
        u.data.user_id &&
        u.data.user_id !== me?.user.user_id
    )
    .map((u) => ({
      ...(u.data as TG_User),
      color: users.find((u2) => u2.user_id === u.data?.user_id)?.color,
    }));

  // Always render Header - it will show login/signup buttons when user is not logged in
  const user = meStatus === 'success' && me?.user.user_id ? me.user : undefined;

  return (
    <Header
      user={user}
      otherUsers={otherUsers}
      logoutAction={user ? logoutAction : undefined}
      permissionsLink={permissionsLink}
      host
      share
      hasNotifications
    />
  );
};
