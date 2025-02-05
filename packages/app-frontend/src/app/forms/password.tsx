import { useMutationChangePassword } from '@monorepo/demiurge-data';
import {
  NewPasswordForm,
  NewPasswordFormData,
  useAction,
} from '@monorepo/demiurge-ui-components';

export const NewPasswordFormLogic = () => {
  const changePassword = useMutationChangePassword();

  const action = useAction<NewPasswordFormData>(
    (d) => changePassword.mutateAsync(d),
    [changePassword]
  );

  return <NewPasswordForm action={action} />;
};
