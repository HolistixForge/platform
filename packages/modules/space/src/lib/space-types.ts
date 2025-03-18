import { TPosition, TEdge } from '@monorepo/core';

export type TSelectingUsers = {
  user: { username: string; color: string };
  viewId: string;
}[];

export type ENodeViewMode = 'REDUCED' | 'EXPANDED';

export type TNodeViewStatus = {
  mode: ENodeViewMode;
  forceOpened: boolean;
  forceClosed: boolean;
  isFiltered: boolean;
  rank: number;
  maxRank: number;
};

export const nodeViewDefaultStatus = (): TNodeViewStatus => ({
  mode: 'EXPANDED',
  forceOpened: false,
  forceClosed: false,
  isFiltered: false,
  rank: 0,
  maxRank: 1,
});

//

export type TNodeView = {
  id: string;
  type: string;
  parentId?: string;
  position: TPosition;
  size?: { width: number; height: number };
  status: TNodeViewStatus;
};

//

export const isNodeOpened = (status: TNodeViewStatus): boolean => {
  let opened = status.rank < status.maxRank;
  if (status.forceOpened) opened = true;
  else if (status.forceClosed) opened = false;
  return opened;
};

//

export type TConnectorView = {
  connectorName: string;
  isOpened: boolean;
  groupedEdgesCount: number;
  type: 'source' | 'target';
};

export const connectorViewDefault = (
  connectorName: string
): TConnectorView => ({
  connectorName,
  isOpened: true,
  groupedEdgesCount: 0,
  type: connectorName === 'inputs' ? 'target' : 'source',
});

//

type TGraphViewParams = {
  /** depth of graph, how much stratum on node to display */
  maxRank: number;
  /** the nodes id from wich the displayed graph is calculated */
  roots: string[];
};

export type TGraphView = {
  /** views options */
  params: TGraphViewParams;
  /** information about rendering for the nodes in this view,
   * kept even if the nodes are not displayed to store user choices for future use
   * (save previous states for future display) */
  nodeViews: Array<TNodeView>;

  connectorViews: { [k: string]: Array<TConnectorView> };
  /** the edges in the current extract */
  edges: Array<TEdge>;

  /** the actual graph displayed */
  graph: {
    /** the subset of nodeViews currently displayed */
    nodes: Array<TNodeView>;
    /** the edges currently displayed */
    edges: Array<TEdge>;
  };
};

//

export const defaultGraphView = (): TGraphView => ({
  params: {
    maxRank: 2,
    roots: [],
  },
  nodeViews: [],
  graph: {
    nodes: [],
    edges: [],
  },
  connectorViews: {},
  edges: [],
});
