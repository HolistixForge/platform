import { useSharedData } from '@monorepo/collab-engine';

import { TEdge, TCoreSharedData } from './core-types';

const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

export const useNodeEdges = (id: string) => {
  const { edges } = useSharedData<TCoreSharedData>(['core:edges'], (sd) => sd);
  const nodeEdges = getNodeEdges(edges || [], id);
  return nodeEdges;
};
