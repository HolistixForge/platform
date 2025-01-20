import { SharedMap, SharedTypes } from '@monorepo/collaborative';
import { TreeElement } from './tree';

export type TabPath = string[];

export const MAX_TAB_ROW = 5;

export type TabPayload =
  | { type: 'none' }
  | { type: 'group' }
  | { type: 'node-editor'; viewId: string }
  | { type: 'resources-grid' }
  | { type: 'resource-ui'; project_server_id: number; service_name: string };

//

export type TUsersActiveTabs = { [k: string]: TabPath };

export type TTabsTree = {
  tree: TreeElement<TabPayload>;
  actives: TUsersActiveTabs;
};

//

export type TTabsSharedData = {
  tabs: SharedMap<TTabsTree>;
};

//

export const Tabs_loadData = (st: SharedTypes): TTabsSharedData => {
  return {
    tabs: st.getSharedMap<TTabsTree>('tabs_system'),
  };
};
