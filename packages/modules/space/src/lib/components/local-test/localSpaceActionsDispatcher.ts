import { TEdge, TGraphNode } from '@monorepo/core';

import { TSpaceActions } from '../../space-events';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';
import { SpaceActionsReducer } from '../apis/spaceActionsReducer';
import { SpaceState } from '../apis/spaceState';
import { graph1 } from './graphs-data/graph-1';
import { TGraphView } from '../../space-types';

//

export const loadStoryGraph = (
  gv: TGraphView,
  nodes: Map<string, TGraphNode>,
  edges: Array<TEdge>
) => {
  graph1.nodes.forEach((node) => nodes.set(node.id, node));
  graph1.edges.forEach((edge) => edges.push(edge));
  gv.edges = graph1.edges;
  gv.nodeViews = graph1.nodeViews;
  gv.graph.nodes = [...gv.nodeViews];
  gv.graph.edges = [...gv.edges];
};

//

export class LocalSpaceActionsDispatcher extends SpaceActionsDispatcher {
  private nodes: Map<string, TGraphNode>;
  private edges: Array<TEdge>;
  private ss: SpaceState;
  private reducer: SpaceActionsReducer;

  constructor(ss: SpaceState) {
    super();

    this.ss = ss;
    const gv = this.ss.getState();
    this.nodes = new Map();
    this.edges = [];
    loadStoryGraph(gv, this.nodes, this.edges);
    this.ss.setState(gv, this.nodes);

    this.reducer = new SpaceActionsReducer();
  }

  //

  dispatch(action: TSpaceActions): void {
    console.log('Dispatching action:', action);
    const gv = this.ss.getState();
    this.reducer.reduce(action, gv, this.nodes, this.edges);
    this.ss.setState(gv, this.nodes);
  }
}
