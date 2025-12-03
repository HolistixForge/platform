import { TJson } from '@holistix/shared-types';

import { SharedArray, SharedMap } from './SharedTypes';

//
//

export type TValidSharedData = {
  [key: string]: SharedArray<any> | SharedMap<any>;
};

export const sharedDataToJson = (sharedData: TValidSharedData) => {
  const dataCopy: { [k: string]: TJson } = {};
  Object.entries(sharedData).forEach(([key, value]) => {
    dataCopy[key] = value.toJSON();
  });
  return dataCopy;
};
