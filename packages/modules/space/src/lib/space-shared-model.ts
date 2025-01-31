import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TGraphView, TUserSelections } from './space-types';

//
//

export type TSpaceSharedData = {
  graphViews: SharedMap<TGraphView>;
  selections: SharedMap<TUserSelections>;
};

export const Space_loadData = (st: SharedTypes): TSpaceSharedData => {
  return {
    graphViews: st.getSharedMap<TGraphView>('demiurge-space_graphViews'),
    selections: st.getSharedMap<TUserSelections>('demiurge-space_selections'),
  };
};
