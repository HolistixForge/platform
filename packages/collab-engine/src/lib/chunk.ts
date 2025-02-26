import { TJson } from '@monorepo/simple-types';

import { SharedArray, SharedMap, SharedTypes } from './SharedTypes';
import { Dispatcher } from './dispatcher';
import { Reducer } from './reducer';

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

//
//

export type TCollaborativeChunk = {
  sharedData?: (st: SharedTypes) => TValidSharedData;

  reducers?: (
    sharedData: TValidSharedData
  ) => Readonly<Reducer<TValidSharedData, any, any, any>[]>;

  extraContext?: (sharedData: TValidSharedData) => object;
};

//
//
export const compileChunks = (
  cc: TCollaborativeChunk[],

  dispatcher: Dispatcher<any, any>,

  extraContext: any
) => {
  return (st: SharedTypes) => {
    let allSharedData: TValidSharedData = {};

    cc.forEach((chunk) => {
      const sharedData = chunk.sharedData?.(st) || {};
      Object.assign(allSharedData, sharedData);

      const reducers = chunk.reducers?.(allSharedData) || [];
      reducers.forEach((r) => dispatcher.addReducer(r));

      const addContext = chunk.extraContext?.(allSharedData) || {};
      Object.assign(extraContext, addContext);
    });
    return allSharedData;
  };
};
