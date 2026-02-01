import { randomGuy } from '@holistix-forge/ui-base';

import { UserDisplayItem } from './user-display-item';

//

type UserDisplayProps = Record<string, never>;

export const UserDisplay = (_props: UserDisplayProps) => {
  return (
    <div className="flex flex-col" style={{ minWidth: '600px', gap: '20px' }}>
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
