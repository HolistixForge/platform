import { TEventOrigin } from '@holistix/core-graph';
import { TAirtableViewMode } from './airtable-types';
import { TJsonObject } from '@holistix/simple-types';

export type TEventInitBase = {
  type: 'airtable:init-base';
  baseId: string;
  origin?: TEventOrigin;
  AIRTABLE_API_KEY: string;
};

export type TEventUpdateRecord = {
  type: 'airtable:update-record';
  baseId: string;
  tableId: string;
  recordId: string;
  fields: TJsonObject;
};

export type TEventCreateRecord = {
  type: 'airtable:create-record';
  baseId: string;
  tableId: string;
  fields: TJsonObject;
};

export type TEventDeleteRecord = {
  type: 'airtable:delete-record';
  baseId: string;
  tableId: string;
  recordId: string;
};

export type TEventReorderRecord = {
  type: 'airtable:reorder-record';
  baseId: string;
  tableId: string;
  recordId: string;
  newPosition: number;
};

export type TEventLoadRecordNode = {
  type: 'airtable:load-record-node';
  recordId: string;
  baseId: string;
  tableId: string;
  origin?: TEventOrigin;
};

export type TEventLoadTableNode = {
  type: 'airtable:load-table-node';
  baseId: string;
  tableId: string;
  origin?: TEventOrigin;
};

export type TEventDeleteRecordNode = {
  type: 'airtable:delete-record-node';
  nodeId: string;
};

export type TEventLoadKanbanColumnNode = {
  type: 'airtable:load-kanban-column-node';
  baseId: string;
  tableId: string;
  fieldId: string;
  optionId: string;
  origin?: TEventOrigin;
};

export type TEventDeleteKanbanColumnNode = {
  type: 'airtable:delete-kanban-column-node';
  nodeId: string;
};

export type TEventDeleteTableNode = {
  type: 'airtable:delete-table-node';
  nodeId: string;
};

export type TEventDeleteBase = {
  type: 'airtable:delete-base';
  baseId: string;
};

export type TEventSetNodeView = {
  type: 'airtable:set-node-view';
  nodeId: string;
  viewId: string;
  viewMode: TAirtableViewMode;
};

export type TEventSearchBases = {
  type: 'airtable:search-bases';
  query?: string;
  userId: string;
  AIRTABLE_API_KEY: string;
};

export type TEventClearUserSearchResults = {
  type: 'airtable:clear-user-search-results';
  userId: string;
};

export type TAirtableEvent =
  | TEventInitBase
  | TEventUpdateRecord
  | TEventCreateRecord
  | TEventDeleteRecord
  | TEventReorderRecord
  | TEventLoadRecordNode
  | TEventLoadTableNode
  | TEventDeleteRecordNode
  | TEventLoadKanbanColumnNode
  | TEventDeleteKanbanColumnNode
  | TEventDeleteTableNode
  | TEventDeleteBase
  | TEventSetNodeView
  | TEventSearchBases
  | TEventClearUserSearchResults;
