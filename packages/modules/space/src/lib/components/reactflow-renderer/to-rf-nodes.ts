import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TNodeView,
  TNodeViewStatus,
} from '../../space-types';
import { Edge as RfEdge, Node as RfNode } from 'reactflow';
import { edgeId, EdgePayload, pinId } from '../apis/types/edge';
import { TEdge } from '@monorepo/core';

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

export type SpaceNode = Omit<RfNode, 'data'> & { data: SpaceNodePayload };

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

const edgeClassNames = (e: TEdge) => {
  const classNames = ['demiurge-space-edge', e.type];
  if (e.highlighted) {
    classNames.push('highlighted');
  }
  if (e.group) {
    classNames.push('edges-group');
  }
  if (e.data?.className) {
    (e.data.className as string[]).forEach?.((c) => classNames.push(c));
  }
  return classNames;
};

//
//

const translateEdge = (e: TEdge): RfEdge<EdgePayload> => {
  const id = edgeId(e);
  const classNames = edgeClassNames(e);

  const r: RfEdge<EdgePayload> = {
    type: 'custom',
    id,
    label: id,
    source: e.from.node,
    target: e.to.node,
    className: `${classNames.join(' ')}`,
    data: {
      type: 'group',
      id,
      edge: e,
    },
  };

  if (e.group) {
    r.data!.type = 'group';
  } else {
    r.sourceHandle = pinId(e.from);
    r.targetHandle = pinId(e.to);
  }

  if (classNames.includes('straight')) {
    r.data!.style = 'straight';
  }
  return r;
};

//
//

export const translateEdges = (edges: Array<TEdge>) =>
  edges.map((edge) => translateEdge(edge));
