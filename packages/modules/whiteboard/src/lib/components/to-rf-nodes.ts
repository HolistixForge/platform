import {
  isNodeOpened,
  nodeViewDefaultStatus,
  TNodeView,
  TNodeViewStatus,
} from '../whiteboard-types';
import { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import { edgeId, ReactflowEdgePayload, pinId } from './apis/types/edge';
import { TEdge } from '@holistix-forge/core-graph';

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

/**
 * Stacking order for nodes.
 *
 * Selection lives in awareness rather than in React Flow's own `selected` flag,
 * so React Flow's `elevateNodesOnSelect` never fires — the elevation has to be
 * expressed as an explicit `zIndex`.
 *
 * Groups sit below everything so that their children always draw on top of
 * their background; groups are not selectable, so they never elevate.
 */
export const NODE_Z_INDEX = {
  group: 0,
  node: 1,
  selected: 1000,
};

const nodeZIndex = (nw: TNodeView, isSelected: boolean) => {
  if (nw.type === 'group') return NODE_Z_INDEX.group;
  return isSelected ? NODE_Z_INDEX.selected : NODE_Z_INDEX.node;
};

const translateNode = (
  nw: TNodeView,
  viewId: string,
  isSelected: boolean
): SpaceNode => {
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
    zIndex: nodeZIndex(nw, isSelected),
    selectable: nw.type !== 'group',
  };
};

//
//

export const translateNodes = (
  nodes: Array<TNodeView>,
  viewId: string,
  /** Ids selected in this view; those nodes are raised above the others. */
  selectedNodeIds: ReadonlySet<string> = new Set()
) => nodes.map((n) => translateNode(n, viewId, selectedNodeIds.has(n.id)));

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
