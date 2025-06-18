import { TCoreSharedData } from '@monorepo/core';
import { TGraphNode } from '@monorepo/module';
import { TEdge } from '@monorepo/core';

import { defaultGraphView, TGraphView } from '../../space-types';
import { graph1 } from './graph-1';
import { TSpaceSharedData } from '../../space-shared-model';
import { STORY_VIEW_ID } from '../story-holistix-space';

//

//

const loadStoryGraph = (
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

export const loadStoryData = (sd: TSpaceSharedData & TCoreSharedData) => {
  const graphViews = sd.graphViews;
  const gv: TGraphView = defaultGraphView();

  loadStoryGraph(gv, sd.nodes as any, sd.edges as any);

  graphViews.set(STORY_VIEW_ID, gv);
};
