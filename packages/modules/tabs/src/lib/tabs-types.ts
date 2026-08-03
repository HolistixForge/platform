import { TreeElement } from './tree';

export type TabPath = string[];

export const MAX_TAB_ROW = 5;

/**
 * Tabs every project gets at initialization. They are recreated on
 * `project:init` when missing, so they must not be deletable from the UI.
 */
export const DEFAULT_DASHBOARD_TAB_TITLE = 'Default Dashboard';
export const RESOURCES_TAB_TITLE = 'Resources';

export type TabPayload =
  | { type: 'none' }
  | { type: 'group' }
  | { type: 'node-editor'; viewId: string }
  | { type: 'resources-grid' }
  | { type: 'resource-ui'; user_container_id: number; service_name: string };

//

export type TUsersActiveTabs = { [k: string]: TabPath };

export type TTabsTree = {
  tree: TreeElement<TabPayload>;
  actives: TUsersActiveTabs;
};

//
