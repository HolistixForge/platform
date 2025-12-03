import { useNavigate } from 'react-router-dom';
import {
  useCurrentUser,
  useMutationLogout,
  useQueriesUsers,
} from '@holistix/frontend-data';
import { useAction } from '@holistix/ui-base';
import { Header } from '@holistix/ui-views';
import { useAwarenessUserList } from '@holistix/collab/frontend';
import { TF_User, TG_User } from '@holistix/types';

//

export const HeaderLogic = () => {
  const { data: me, status: meStatus } = useCurrentUser();

  const logout = useMutationLogout();

  const navigate = useNavigate();

  const logoutAction = useAction(() => {
    return logout.mutateAsync().then(() => navigate('/'));
  }, [logout, navigate]);

  if (meStatus === 'success')
    return (
      <Header
        user={me.user.user_id ? me.user : undefined}
        logoutAction={logoutAction}
        host
        share
        hasNotifications
      />
    );
  return null;
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

  // queries for each needed user
  const usersQueries = useQueriesUsers(users.map((u) => u.user_id));

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

  if (meStatus === 'success')
    return (
      <Header
        user={me.user.user_id ? me.user : undefined}
        otherUsers={otherUsers}
        logoutAction={logoutAction}
        host
        share
        hasNotifications
      />
    );
  return null;
};
