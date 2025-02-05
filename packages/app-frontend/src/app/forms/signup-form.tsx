import { useMutationSignup } from '@monorepo/demiurge-data';
import {
  SignupForm,
  SignupFormData,
  useAction,
} from '@monorepo/demiurge-ui-components';
import { useNavigate } from 'react-router-dom';

//
//

export const SignupFormLogic = () => {
  const navigate = useNavigate();

  const signup = useMutationSignup();

  const action = useAction<SignupFormData>(
    (d) => signup.mutateAsync(d).then(() => navigate('/')),
    [navigate, signup]
  );

  return (
    <div>
      <SignupForm action={action} />
    </div>
  );
};
