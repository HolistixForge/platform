import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useMutationLogout } from '@monorepo/demiurge-data';
import { Header, useAction } from '@monorepo/demiurge-ui-components';

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
