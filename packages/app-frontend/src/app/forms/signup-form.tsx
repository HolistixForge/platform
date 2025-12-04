import { useMutationSignup } from '@holistix-forge/frontend-data';
import { useAction } from '@holistix-forge/ui-base';
import { SignupForm } from '@holistix-forge/ui-views';
import { SignupFormData } from '@holistix-forge/frontend-data';
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
