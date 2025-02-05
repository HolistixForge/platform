import { Sidebar } from '@monorepo/demiurge-ui-components';

import { Header } from '../components/header';
import { ResourceBar } from '../components/resource-bar';
import { FilterBox } from '../components/filter-box';
import { UserList } from '../components/user-list';
import { menuItems } from './access-role';

//

export type AccessesProps = {};

export const Accesses = ({}: AccessesProps) => {
  return (
    <div className="w-[1920px] h-[1080px] border">
      <Header hasNotifications />
      <ResourceBar title="Accesses" />
      <div className="flex justify-between pl-[20px] pt-[7px]">
        <div className="flex items-center gap-[9px]">
          <span className="text-[9px] text-white/80">Accesses</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
        </div>
      </div>
      <div className="h-[calc(1080px-90px)] relative pt-[20px] flex gap-[30px]">
        <Sidebar active={'authorizations'} items={menuItems} />

        <div className="w-full mt-4">
          <section className="pt-[10px] w-full pr-[50px] grid grid-cols-12 gap-[30px]">
            <div className="col-span-4">
              <UserList />
            </div>
            <div className="col-span-4 flex flex-col gap-5">
              <FilterBox name="Groups" mode="Group" />
            </div>
            <div className="col-span-4">
              <FilterBox name="Roles" mode="Role" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
