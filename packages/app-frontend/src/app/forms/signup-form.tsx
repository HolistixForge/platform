import { useMutationSignup } from '@holistix/frontend-data';
import { useAction } from '@holistix/ui-base';
import { SignupForm } from '@holistix/ui-views';
import { SignupFormData } from '@holistix/frontend-data';
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
