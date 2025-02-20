import {
  SharedMap,
  SharedTypes,
  SharedArray,
  useSharedData,
} from '@monorepo/collab-engine';
import { TGraphNode, TEdge, TProjectMeta } from './core-types';

export type TCoreSharedData = {
  meta: SharedMap<TProjectMeta>;
  nodes: SharedMap<TGraphNode>;
  edges: SharedArray<TEdge>;
};

export const Core_loadData = (st: SharedTypes): TCoreSharedData => {
  return {
    meta: st.getSharedMap('demiurge-meta'),
    nodes: st.getSharedMap<TGraphNode>('demiurge-nodes'),
    edges: st.getSharedArray<TEdge>('demiurge-edges'),
  };
};

//

export const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

export const useNodeEdges = (id: string) => {
  const { edges } = useSharedData<TCoreSharedData>(['edges'], (sd) => sd);
  const nodeEdges = getNodeEdges(edges.toArray() || [], id);
  return nodeEdges;
};
