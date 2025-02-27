import { TEventOrigin } from '@monorepo/core';
import { TNotionProperty } from './notion-types';

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

export type TNotionEvent =
  | TEventInitDatabase
  | TEventUpdatePage
  | TEventCreatePage
  | TEventDeletePage
  | TEventReorderPage
  | TEventSyncDatabase;
