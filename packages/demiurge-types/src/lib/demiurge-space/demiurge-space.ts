import { SharedArray, SharedMap, SharedTypes } from '@monorepo/collaborative';
import { TGraphView } from './graph-view';
import { TUserSelections } from './user-selection';
import { TDemiurgeEdge } from '../demiurge-notebook/edge-types';

// TODO_DEMIURGE_SPACE : relocate all this folder except for this file

export type TDemiurgeSpaceSharedData = {
  edges: SharedArray<TDemiurgeEdge>;
  graphViews: SharedMap<TGraphView>;
  selections: SharedMap<TUserSelections>;
};

export const DemiurgeSpace_loadData = (
  st: SharedTypes
): TDemiurgeSpaceSharedData => {
  return {
    edges: st.getSharedArray<TDemiurgeEdge>('demiurge-space_edges'),
    graphViews: st.getSharedMap<TGraphView>('demiurge-space_graphViews'),
    selections: st.getSharedMap<TUserSelections>('demiurge-space_selections'),
  };
};
