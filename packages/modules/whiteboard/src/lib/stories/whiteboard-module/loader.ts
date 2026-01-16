import { TGraphNode, TEdge, TCoreSharedData } from '@holistix-forge/core-graph';
import { Collab } from '@holistix-forge/collab';

import { defaultGraphView, TGraphView } from '../../whiteboard-types';
import { graph1 } from './graph-1';
import { TWhiteboardSharedData } from '../../..';
import { STORY_VIEW_ID } from '../story-whiteboard';

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

/**
 * Load test data for whiteboard stories
 * Initializes the story project's shared data
 */
export const loadStoryData = (
  collab: Collab<TWhiteboardSharedData & TCoreSharedData>
) => {
  const graphViews = collab.sharedData['whiteboard:graphViews'];
  const gv: TGraphView = defaultGraphView();

  loadStoryGraph(
    gv,
    collab.sharedData['core-graph:nodes'] as any,
    collab.sharedData['core-graph:edges'] as any
  );

  graphViews.set(STORY_VIEW_ID, gv);
};
