import { TJsonObject } from '@monorepo/simple-types';
import { TGraphNode } from '@monorepo/module';
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

export type TEventLoad = {
  type: 'core:load';
};

export type TEventDisableGatewayShutdown = {
  type: 'core:disable-gateway-shutdown';
};

export type TCoreEvent =
  | TEventNewNode
  | TEventDeleteNode
  | TEventNewEdge
  | TEventDeleteEdge
  | TEventLoad
  | TEventDisableGatewayShutdown;
