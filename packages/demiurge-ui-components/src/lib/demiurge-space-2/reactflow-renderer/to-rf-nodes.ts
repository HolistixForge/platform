import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TAnyEdge,
  TEdge,
  TNodeView,
  TNodeViewStatus,
} from '@monorepo/demiurge-types';
import { Edge as RfEdge, Node as RfNode } from 'reactflow';
import { SimpleEdgePayload } from '../old/graphLogic/graph-logic';

//
//

const statusToClassName = (status: TNodeViewStatus) => {
  const opened = isNodeOpened(status);
  const className = opened ? 'node-opened' : 'node-closed';
  return className;
};

//
//

export type SpaceNodePayload = {
  id: string;
  viewStatus: TNodeViewStatus;
  viewId: string;
};

type SpaceNode = Omit<RfNode, 'data'> & { data: SpaceNodePayload };

//
//

const translateNode = (nw: TNodeView, viewId: string): SpaceNode => {
  const s = nw.status || nodeViewDefaultStatus();
  const data = {
    id: nw.id,
    viewStatus: s,
    viewId,
  };
  return {
    id: nw.id,
    type: 'wrapper',
    position: nw.position,
    data,
    className: statusToClassName(s),
    draggable: true,
    selectable: true,
  };
};

//
//

export const translateNodes = (nodes: Array<TNodeView>, viewId: string) =>
  nodes.map((n) => translateNode(n, viewId));

//
//

const edgeClassName = (e: TEdge) => {
  return ['demiurge-space-edge', e.type];
};

//
//

export type SpaceEdgePayload = SimpleEdgePayload & {
  text: string;
  edge: TAnyEdge;
};

type SpaceEdge = Omit<RfEdge, 'data'> & { data: SpaceEdgePayload };

//
//

const translateEdge = (e: TEdge): SpaceEdge => {
  const l = edgeLabel(e);
  return {
    id: l,
    source: e.from.node,
    target: e.to.node,
    label: l,
    sourceHandle: e.from.connector,
    targetHandle: e.to.connector,
    className: `${edgeClassName(e).join(' ')}`,
    type: 'custom',
    data: {
      type: 'simple',
      text: l,
      edge: e,
    },
  };
};

//
//

export const translateEdges = (edges: Array<TEdge>) =>
  edges.map((edge) => translateEdge(edge));

//
//

export const edgeLabel = (e: TEdge) =>
  `[${e.from.node} # ${e.from.connector || 'default'}] -> [${e.to.node} # ${
    e.to.connector || 'default'
  }]`;
