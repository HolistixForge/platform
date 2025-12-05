import { useMutationChangePassword } from '@holistix-forge/frontend-data';
import { useAction } from '@holistix-forge/ui-base';
import { NewPasswordForm } from '@holistix-forge/ui-views';
import { NewPasswordFormData } from '@holistix-forge/frontend-data';

//

export const NewPasswordFormLogic = () => {
  const changePassword = useMutationChangePassword();

  const action = useAction<NewPasswordFormData>(
    (d) => changePassword.mutateAsync(d),
    [changePassword]
  );

  return <NewPasswordForm action={action} />;
};
