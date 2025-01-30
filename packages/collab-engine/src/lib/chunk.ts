import { SharedArray, SharedMap, SharedTypes } from './SharedTypes';
import { Dispatcher } from './dispatcher';
import { Reducer } from './reducer';

//
//

export type TValidSharedData = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: SharedArray<any> | SharedMap<any>;
};

//
//

export type TCollaborativeChunk = {
  initChunk: (st: SharedTypes) => {
    sharedData: TValidSharedData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reducers: Readonly<Reducer<TValidSharedData, any, any, any>[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extraContext?: any;
  };
};

//
//

export const compileChunks = (
  cc: TCollaborativeChunk[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatcher: Dispatcher<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraContext: any
) => {
  return (st: SharedTypes) => {
    let allSharedData = {};
    cc.forEach((chunk) => {
      const {
        sharedData,
        reducers: reducers,
        extraContext: ec,
      } = chunk.initChunk(st);

      allSharedData = {
        ...allSharedData,
        ...sharedData,
      };

      for (const key in ec) extraContext[key] = ec[key];

      reducers.forEach((r) => dispatcher.addReducer(r));
    });
    return allSharedData;
  };
};
