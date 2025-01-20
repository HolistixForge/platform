import { TabPath } from './tabs';

export type TEventActiveTabChange = {
  type: 'active-tab-change';
  path: TabPath;
};

export type TEventAddTab<T> = {
  type: 'add-tab';
  path: TabPath;
  title: string;
  payload: T;
};

export type TEventDeleteTab = {
  type: 'delete-tab';
  path: TabPath;
};

export type TEventConvertTabToGroup = {
  type: 'convert-tab-to-group';
  path: TabPath;
};

export type TEventRenameTab = {
  type: 'rename-tab';
  path: TabPath;
  title: string;
};

export type TTabEvents<T> =
  | TEventActiveTabChange
  | TEventAddTab<T>
  | TEventDeleteTab
  | TEventConvertTabToGroup
  | TEventRenameTab;
