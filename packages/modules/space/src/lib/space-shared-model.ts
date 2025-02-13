import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TGraphView } from './space-types';

//
//

export type TSpaceSharedData = {
  graphViews: SharedMap<TGraphView>;
};

export const Space_loadData = (st: SharedTypes): TSpaceSharedData => {
  return {
    graphViews: st.getSharedMap<TGraphView>('demiurge-space_graphViews'),
  };
};
