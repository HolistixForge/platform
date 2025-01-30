import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TEdge, TNodeView } from '@monorepo/demiurge-ui-components';

export type TUserViewSelection = {
  user: { username: string; color: string };
  userId: number;
  viewId: string;
  nodes: string[];
  edges: string[];
};

type TUserSelections = TUserViewSelection[];

//
//

type TGraphViewParams = {
  /** depth of graph, how much stratum on node to display */
  maxRank: number;
};

export type TGraphView = {
  /** views options */
  params: TGraphViewParams;
  /** the nodes id from wich the displayed graph is calculated */
  roots: string[];
  /** information about rendering for the nodes in this view,
   * kept wether the nodes are indeed displayed or not
   * (save previous states for future display) */
  nodeViews: Array<TNodeView>;
  /** the actual graph displayed */
  graph: {
    /** the subset of nodeViews currently displayed */
    nodes: Array<TNodeView>;
    /** the edges currently displayed */
    edges: Array<TEdge>;
  };
};

//
//

export type TSpaceSharedData = {
  graphViews: SharedMap<TGraphView>;
  selections: SharedMap<TUserSelections>;
};

export const Space_loadData = (st: SharedTypes): TSpaceSharedData => {
  return {
    graphViews: st.getSharedMap<TGraphView>('demiurge-space_graphViews'),
    selections: st.getSharedMap<TUserSelections>('demiurge-space_selections'),
  };
};
