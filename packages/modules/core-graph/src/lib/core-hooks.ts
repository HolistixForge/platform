import { useLocalSharedData } from '@holistix/collab/frontend';

import { TEdge, TCoreSharedData } from './core-types';

const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

export const useNodeEdges = (id: string) => {
  const { edges } = useLocalSharedData<TCoreSharedData>(
    ['core-graph:edges'],
    (sd) => sd
  );
  const nodeEdges = getNodeEdges(edges || [], id);
  return nodeEdges;
};
