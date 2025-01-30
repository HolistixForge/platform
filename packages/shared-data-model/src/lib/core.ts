import { SharedMap, SharedTypes, SharedArray } from '@monorepo/collab-engine';
import { TEdge } from '@monorepo/demiurge-ui-components';
import { TJsonObject } from '@monorepo/simple-types';

export type TProjectMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
  };
};

export type TGraphNode = {
  id: string;
  name: string;
  type: string;
  root: boolean;
  data?: TJsonObject;
  connectors: {
    connectorName: string;
    disabled?: boolean;
    pins: {
      pinName: string;
      disabled?: boolean;
      type?: 'in' | 'out' | 'inout';
    }[];
  }[];
};

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
