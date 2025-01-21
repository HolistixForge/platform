import { TJson } from '@monorepo/simple-types';
import { TEdgeEnd } from '../edge';
import { TPosition } from '../node';
import { TUserViewSelection } from './user-selection';

export type TEventOrigin = {
  viewId: string;
  position: TPosition;
};

// TODO_DEMIURGE_SPACE: delete

export type TEventNewNode<
  NodeData extends TJson = TJson,
  EdgeData extends TJson = TJson
> = {
  type: 'new-node';
  from?: TEdgeEnd;
  nodeData: NodeData;
  edgeData?: EdgeData;
} & TEventOrigin;

export type TEventDeleteNode = {
  type: 'delete-node';
  id: string;
};

export type TEventMoveNode = {
  type: 'move-node';
  viewId: string;
  nid: string;
  position: TPosition;
};

export type TEventOpenNode = {
  type: 'open-node';
  viewId: string;
  nid: string;
};

export type TEventCloseNode = {
  type: 'close-node';
  viewId: string;
  nid: string;
};

export type TEventReduceNode = {
  type: 'reduce-node';
  viewId: string;
  nid: string;
};

export type TEventExpandNode = {
  type: 'expand-node';
  viewId: string;
  nid: string;
};

export type TEventUpdateGraphView = {
  type: '_update-graph-view_';
  why: string;
  viewId: string;
};

export type TEventSelectionChange = {
  type: 'selection-change';
} & TUserViewSelection;

export type TDemiurgeSpaceEvent =
  | TEventNewNode<TJson, TJson>
  | TEventDeleteNode
  | TEventOpenNode
  | TEventCloseNode
  | TEventMoveNode
  | TEventSelectionChange
  | TEventUpdateGraphView
  | TEventExpandNode
  | TEventReduceNode;
