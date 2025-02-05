import { useMutationChangePassword } from '@monorepo/frontend-data';
import { useAction } from '@monorepo/demiurge-ui-components';
import { NewPasswordForm } from '@monorepo/ui-views';
import { NewPasswordFormData } from '@monorepo/frontend-data';

//

export const NewPasswordFormLogic = () => {
  const changePassword = useMutationChangePassword();

  const action = useAction<NewPasswordFormData>(
    (d) => changePassword.mutateAsync(d),
    [changePassword]
  );

  return <NewPasswordForm action={action} />;
};
