import { TGraphNode } from '@monorepo/core';

import { TSpaceActions } from '../../space-events';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';
import { SpaceActionsReducer } from '../apis/spaceActionsReducer';
import { SpaceState } from '../apis/spaceState';
import { graph1 } from './graphs-data/graph-1';

//

export class LocalSpaceActionsDispatcher extends SpaceActionsDispatcher {
  private nodes: Map<string, TGraphNode>;
  private ss: SpaceState;
  private reducer: SpaceActionsReducer;

  constructor(ss: SpaceState) {
    super();

    this.ss = ss;
    const gv = this.ss.getState();

    this.nodes = new Map();
    graph1.nodes.forEach((node) => this.nodes.set(node.id, node));

    gv.edges = graph1.edges;
    gv.nodeViews = graph1.nodeViews;

    this.ss.setState(gv, this.nodes);

    this.reducer = new SpaceActionsReducer();
  }

  dispatch(action: TSpaceActions): void {
    console.log('Dispatching action:', action);
    const gv = this.ss.getState();
    this.reducer.reduce(action, gv, this.nodes);
    this.ss.setState(gv, this.nodes);
  }
}
