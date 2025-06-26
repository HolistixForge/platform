import { TEventOrigin } from '@monorepo/core';
import { TNotionProperty } from './notion-types';
import { TNotionViewMode } from './components/node-notion/notion-database';

export type TEventInitDatabase = {
  type: 'notion:init-database';
  databaseId: string;
  origin?: TEventOrigin;
};

export type TEventUpdatePage = {
  type: 'notion:update-page';
  databaseId: string;
  pageId: string;
  properties: Record<string, TNotionProperty>;
};

export type TEventCreatePage = {
  type: 'notion:create-page';
  databaseId: string;
  properties: Record<string, TNotionProperty>;
};

export type TEventDeletePage = {
  type: 'notion:delete-page';
  databaseId: string;
  pageId: string;
};

export type TEventReorderPage = {
  type: 'notion:reorder-page';
  databaseId: string;
  pageId: string;
  newPosition: number;
};

export type TEventSyncDatabase = {
  type: 'notion:sync-database';
  databaseId: string;
};

export type TEventLoadPageNode = {
  type: 'notion:load-page-node';
  pageId: string;
  origin?: TEventOrigin;
};

export type TEventDeletePageNode = {
  type: 'notion:delete-page-node';
  pageId: string;
};

export type TEventDeleteDatabaseNode = {
  type: 'notion:delete-database-node';
  nodeId: string;
};

export type TEventDeleteDatabase = {
  type: 'notion:delete-database';
  databaseId: string;
};

export type TEventSetNodeView = {
  type: 'notion:set-node-view';
  nodeId: string;
  viewId: string;
  viewMode: TNotionViewMode;
};

export type TNotionEvent =
  | TEventInitDatabase
  | TEventUpdatePage
  | TEventCreatePage
  | TEventDeletePage
  | TEventReorderPage
  | TEventSyncDatabase
  | TEventLoadPageNode
  | TEventDeletePageNode
  | TEventDeleteDatabaseNode
  | TEventDeleteDatabase
  | TEventSetNodeView;
