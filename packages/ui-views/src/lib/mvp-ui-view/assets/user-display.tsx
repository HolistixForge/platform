import { randomGuy } from '../../utils/random-guys';
import { UserDisplayItem } from './user-display-item';

interface UserDisplayProps {
  //mail : bool
  //team : str
  //setting : bool
  //icon-resource : delete | remove | filter
}

export const UserDisplay = ({}: UserDisplayProps) => {
  return (
    <div className="min-w-[600px] flex flex-col gap-5">
      <UserDisplayItem
        user={randomGuy()}
        role="role"
        roleColor="#39b139"
        mail="chrys.beltran@outlook.fr"
      />
      <UserDisplayItem
        user={randomGuy()}
        role="role"
        roleColor="#39b139"
        mail="chrys.beltran@outlook.fr"
      />
      <UserDisplayItem
        user={randomGuy()}
        role="role"
        roleColor="#39b139"
        mail="chrys.beltran@outlook.fr"
      />
    </div>
  );
};
