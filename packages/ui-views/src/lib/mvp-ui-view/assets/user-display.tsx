import { randomGuy } from '@holistix-forge/ui-base';

import { UserDisplayItem } from './user-display-item';

//

type UserDisplayProps = {};

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
