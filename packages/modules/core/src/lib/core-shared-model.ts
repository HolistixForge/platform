import { inSeconds } from '@monorepo/simple-types';
import {
  SharedMap,
  SharedTypes,
  SharedArray,
  useSharedData,
} from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/module';
import { TEdge, TProjectMeta } from './core-types';
import { GATEWAY_INACIVITY_SHUTDOWN_DELAY } from './meta-reducer';

export type TCoreSharedData = {
  meta: SharedMap<TProjectMeta>;
  nodes: SharedMap<TGraphNode>;
  edges: SharedArray<TEdge>;
};

export const Core_loadData = (st: SharedTypes): TCoreSharedData => {
  const meta = st.getSharedMap<TProjectMeta>('demiurge-meta');

  const disable_gateway_shutdown =
    meta.get('meta')?.projectActivity.disable_gateway_shutdown || false;

  const newMeta = {
    projectActivity: {
      last_activity: new Date().toISOString(),
      gateway_shutdown: inSeconds(
        GATEWAY_INACIVITY_SHUTDOWN_DELAY,
        new Date()
      ).toISOString(),
      disable_gateway_shutdown,
    },
  };

  console.log('#####---> Core_loadData: meta', newMeta);

  meta.set('meta', newMeta);
  return {
    meta,
    nodes: st.getSharedMap<TGraphNode>('demiurge-nodes'),
    edges: st.getSharedArray<TEdge>('demiurge-edges'),
  };
};

//

export const getNodeEdges = (edges: Array<TEdge>, nid: string) =>
  edges.filter((edge) => edge.from.node === nid || edge.to.node === nid);

export const useNodeEdges = (id: string) => {
  const { edges } = useSharedData<TCoreSharedData>(['edges'], (sd) => sd);
  const nodeEdges = getNodeEdges(edges || [], id);
  return nodeEdges;
};
