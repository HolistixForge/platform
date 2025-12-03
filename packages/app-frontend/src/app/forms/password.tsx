import { useMutationChangePassword } from '@holistix/frontend-data';
import { useAction } from '@holistix/ui-base';
import { NewPasswordForm } from '@holistix/ui-views';
import { NewPasswordFormData } from '@holistix/frontend-data';

//

export const NewPasswordFormLogic = () => {
  const changePassword = useMutationChangePassword();

  const action = useAction<NewPasswordFormData>(
    (d) => changePassword.mutateAsync(d),
    [changePassword]
  );

  return <NewPasswordForm action={action} />;
};
