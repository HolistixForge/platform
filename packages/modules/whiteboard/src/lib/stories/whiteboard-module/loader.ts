import { TCoreSharedData } from '@holistix-forge/core-graph';
import { TGraphNode } from '@holistix-forge/core-graph';
import { TEdge } from '@holistix-forge/core-graph';

import { defaultGraphView, TGraphView } from '../../whiteboard-types';
import { graph1 } from './graph-1';
import { TWhiteboardSharedData } from '../../..';
import { STORY_VIEW_ID } from '../story-whiteboard';

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

export const loadStoryData = (sd: TWhiteboardSharedData & TCoreSharedData) => {
  const graphViews = sd['whiteboard:graphViews'];
  const gv: TGraphView = defaultGraphView();

  loadStoryGraph(
    gv,
    sd['core-graph:nodes'] as any,
    sd['core-graph:edges'] as any
  );

  graphViews.set(STORY_VIEW_ID, gv);
};
