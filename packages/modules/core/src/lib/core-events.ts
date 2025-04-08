import { TEdge, TGraphNode, TPosition } from './core-types';

export type TEventOrigin = {
  viewId: string;
  position: TPosition;
};

export type TEventNewNode = {
  type: 'core:new-node';
  nodeData: TGraphNode;
  edges: TEdge[];
  origin?: TEventOrigin;
};

export type TEventDeleteNode = {
  type: 'core:delete-node';
  id: string;
};

export type TEventNewEdge = {
  type: 'core:new-edge';
  edge: TEdge;
};

export type TEventDeleteEdge = {
  type: 'core:delete-edge';
  edge: TEdge;
};

export type TEventLoad = {
  type: 'core:load';
};

export type TCoreEvent =
  | TEventNewNode
  | TEventDeleteNode
  | TEventNewEdge
  | TEventDeleteEdge
  | TEventLoad;
