import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TNodeView,
  TNodeViewStatus,
} from '../space-types';
import { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import { edgeId, ReactflowEdgePayload, pinId } from './apis/types/edge';
import { TEdge } from '@monorepo/core-graph';

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
  nv: TNodeView;
  viewId: string;
};

export type SpaceNode = Omit<RfNode, 'data'> & { data: SpaceNodePayload };

//
//

const translateNode = (nw: TNodeView, viewId: string): SpaceNode => {
  const s = nw.status || nodeViewDefaultStatus();
  const data = {
    viewId,
    nv: nw,
  };
  return {
    id: nw.id,
    type: 'wrapper',
    position: nw.position,
    parentId: nw.parentId,
    data,
    className: statusToClassName(s),
    draggable: true,
    // zIndex: nw.type === 'group' ? 1000 : 2000,
    selectable: nw.type !== 'group',
  };
};

//
//

export const translateNodes = (nodes: Array<TNodeView>, viewId: string) =>
  nodes.map((n) => translateNode(n, viewId));

//
//

const translateEdge = (e: TEdge): RfEdge<ReactflowEdgePayload> => {
  const id = edgeId(e);

  const r: RfEdge<ReactflowEdgePayload> = {
    type: 'custom',
    id,
    label: id,
    source: e.from.node,
    target: e.to.node,
    data: {
      id,
      edge: e,
    },
    // force reactflow to generate markers def and pass corresponding id to our custom edge component
    markerEnd: (e as any).renderProps?.markerEnd,
    markerStart: (e as any).renderProps?.markerStart,
  };

  if (!e.group) {
    r.sourceHandle = pinId(e.from);
    r.targetHandle = pinId(e.to);
  }

  return r;
};

//
//

export const translateEdges = (edges: Array<TEdge>) =>
  edges.map((edge) => translateEdge(edge));
