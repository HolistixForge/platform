import { useLocalSharedData } from '@holistix-forge/collab/frontend';

import { TEdge, TCoreSharedData } from './core-types';

const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

export const useNodeEdges = (id: string) => {
  // The local copy is keyed by the full shared-data key, so the edges live
  // under 'core-graph:edges'. Selecting `sd` and destructuring `edges` off it
  // read a key that has never existed: this hook returned an empty array to
  // every caller, which silently disabled anything that looks up a node's
  // neighbours — the chat node's reduce and filter-out buttons among them.
  const edges = useLocalSharedData<TCoreSharedData>(
    ['core-graph:edges'],
    (sd) => sd['core-graph:edges']
  );
  return getNodeEdges(edges || [], id);
};
