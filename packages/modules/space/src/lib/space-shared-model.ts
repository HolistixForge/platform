import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TGraphView } from './space-types';
import { TJsonObject } from '@monorepo/simple-types';

//
//

export type TSpaceSharedData = {
  graphViews: SharedMap<TGraphView>;
  drawing: SharedMap<TJsonObject>;
};

export const Space_loadData = (st: SharedTypes): TSpaceSharedData => {
  return {
    graphViews: st.getSharedMap<TGraphView>('demiurge-space_graphViews'),
    drawing: st.getSharedMap<TJsonObject>('demiurge-space_drawing'),
  };
};
