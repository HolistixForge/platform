import { useNavigate } from 'react-router-dom';
import {
  useCurrentUser,
  useMutationLogout,
  useQueriesUsers,
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

  // No permissions key here either. It is in the rail on every page that has
  // one, and the organization pages have one now — so the header carrying a
  // second way in only made the same screen offer the same door twice.

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

  // No permissions key here: on a project page it lives in the rail, beside
  // the project's other places. Two ways in, on the same screen, is one more
  // than there should be — and the rail is where a question about *this*
  // project's people belongs. The organization header keeps its key, having
  // no rail to put one in.

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
      host
      share
      hasNotifications
    />
  );
};
