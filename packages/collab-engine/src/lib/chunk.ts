import { TJson } from '@monorepo/simple-types';

import { SharedArray, SharedMap, SharedTypes } from './SharedTypes';
import { BackendEventProcessor } from './backendEventProcessor';
import { Reducer } from './reducer';
import { FrontendDispatcher } from './frontend/frontendDispatcher';

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
  name: string;

  loadSharedData?: (st: SharedTypes) => TValidSharedData;

  loadReducers?: (
    sharedData: TValidSharedData
  ) => Readonly<Reducer<TValidSharedData, any, any, any, any>[]>;

  loadExtraContext?: (a: {
    sharedData: TValidSharedData;
    extraContext: object;
    dispatcher?: FrontendDispatcher<any>;
    bep?: BackendEventProcessor<any, any>;
  }) => object;

  deps?: string[];
};

//
//
export const compileChunks = (
  chunks: TCollaborativeChunk[],
  sharedTypes: SharedTypes,
  o: {
    dispatcher?: FrontendDispatcher<any>;
    bep?: BackendEventProcessor<any, any>;
    extraContext?: Record<string, any>;
  }
) => {
  const allSharedData: TValidSharedData = {};
  const extraContext: Record<string, any> = o.extraContext || {};

  chunks.forEach((chunk) => {
    if (chunk.deps) {
      chunk.deps.forEach((d) => {
        if (!extraContext[d])
          throw new Error(`Chunk ${d} is not loaded (deps of ${chunk.name})`);
      });
    }

    const sharedData = chunk.loadSharedData?.(sharedTypes) || {};
    Object.assign(allSharedData, sharedData);

    const reducers = chunk.loadReducers?.(allSharedData) || [];
    reducers.forEach((r) => o.bep?.addReducer(r));

    const addContext = chunk.loadExtraContext?.({
      sharedData: allSharedData,
      extraContext,
      ...o,
    }) || { [chunk.name]: {} };
    Object.assign(extraContext, addContext);
  });

  return { sharedData: allSharedData, extraContext };
};
