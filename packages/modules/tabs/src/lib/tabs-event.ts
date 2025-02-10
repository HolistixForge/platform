import { TabPath } from './tabs-types';

export type TEventActiveTabChange = {
  type: 'tabs:active-tab-change';
  path: TabPath;
};

export type TEventAddTab<T> = {
  type: 'tabs:add-tab';
  path: TabPath;
  title: string;
  payload: T;
};

export type TEventDeleteTab = {
  type: 'tabs:delete-tab';
  path: TabPath;
};

export type TEventConvertTabToGroup = {
  type: 'tabs:convert-tab-to-group';
  path: TabPath;
};

export type TEventRenameTab = {
  type: 'tabs:rename-tab';
  path: TabPath;
  title: string;
};

export type TTabEvents<T> =
  | TEventActiveTabChange
  | TEventAddTab<T>
  | TEventDeleteTab
  | TEventConvertTabToGroup
  | TEventRenameTab;
