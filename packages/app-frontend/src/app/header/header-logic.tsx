import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useMutationLogout } from '@monorepo/frontend-data';
import { useAction } from '@monorepo/ui-base';
import { Header } from '@monorepo/ui-views';

//

export const HeaderLogic = () => {
  const { data, status } = useCurrentUser();

  const logout = useMutationLogout();

  const navigate = useNavigate();

  const logoutAction = useAction(() => {
    return logout.mutateAsync().then(() => navigate('/'));
  }, [logout, navigate]);

  if (status === 'success')
    return (
      <Header
        user={data.user.user_id ? data.user : undefined}
        logoutAction={logoutAction}
        host
        share
        hasNotifications
      />
    );
  return null;
};
