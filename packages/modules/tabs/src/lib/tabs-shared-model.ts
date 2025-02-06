import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TTabsTree } from './tabs-types';

export type TTabsSharedData = {
  tabs: SharedMap<TTabsTree>;
};

//

export const Tabs_loadData = (st: SharedTypes): TTabsSharedData => {
  return {
    tabs: st.getSharedMap<TTabsTree>('tabs_system'),
  };
};
