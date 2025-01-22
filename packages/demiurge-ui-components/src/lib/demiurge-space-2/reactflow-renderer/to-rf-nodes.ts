import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TNodeView,
  TNodeViewStatus,
} from '../apis/types/node';
import { Edge as RfEdge, Node as RfNode } from 'reactflow';
import { edgeId, EdgePayload, pinId, TEdge } from '../apis/types/edge';

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

const translateEdge = (e: TEdge): RfEdge<EdgePayload> => {
  const id = edgeId(e);
  if (e.group) {
    return {
      type: 'custom',
      id,
      label: id,
      source: e.from.node,
      target: e.to.node,
      className: 'edges-group',
      data: {
        type: 'group',
        id,
        edge: e,
      },
    };
  } else {
    return {
      type: 'custom',
      id,
      label: id,
      source: e.from.node,
      target: e.to.node,
      sourceHandle: pinId(e.from),
      targetHandle: pinId(e.to),
      className: `${edgeClassName(e).join(' ')}`,
      data: {
        type: 'simple',
        id,
        edge: e,
      },
    };
  }
};

//
//

export const translateEdges = (edges: Array<TEdge>) =>
  edges.map((edge) => translateEdge(edge));
