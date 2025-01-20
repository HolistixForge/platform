import { TNodeView } from '../node';
import { TEdge } from '../edge';

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
