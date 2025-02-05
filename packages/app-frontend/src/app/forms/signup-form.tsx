import { useMutationSignup } from '@monorepo/frontend-data';
import { useAction } from '@monorepo/demiurge-ui-components';
import { SignupForm } from '@monorepo/ui-views';
import { SignupFormData } from '@monorepo/frontend-data';
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
