import { TJsonObject } from '@holistix/simple-types';
import { TGraphNode } from './core-types';
import { TEdge, TPosition } from './core-types';

export type TEventOrigin = {
  viewId: string;
  position: TPosition;
};

export type TEventNewNode = {
  type: 'core:new-node';
  nodeData: TGraphNode;
  edges: (TEdge & TJsonObject)[];
  origin?: TEventOrigin;
};

export type TEventDeleteNode = {
  type: 'core:delete-node';
  id: string;
};

export type TEventNewEdge = {
  type: 'core:new-edge';
  edge: TEdge & TJsonObject;
};

export type TEventDeleteEdge = {
  type: 'core:delete-edge';
  edge: TEdge;
};

export type TCoreEvent =
  | TEventNewNode
  | TEventDeleteNode
  | TEventNewEdge
  | TEventDeleteEdge;
