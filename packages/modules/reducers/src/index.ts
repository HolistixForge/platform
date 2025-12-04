import { TModule } from '@holistix-forge/module';
import { TJson, TJsonWithUndefined, TStringMap } from '@holistix-forge/simple-types';
import { BackendEventProcessor } from './lib/backendEventProcessor';

export type TBaseEvent = { type: string; [key: string]: TJsonWithUndefined };

export abstract class RequestData {
  abstract get ip(): string;
  abstract get user_id(): string;
  abstract get jwt(): TJson;
  abstract get headers(): TStringMap;
}

export abstract class Reducer<TEvents = TBaseEvent> {
  abstract reduce(e: TEvents, requestData: RequestData): Promise<void>;
}

export type TReducersBackendExports = {
  processEvent: (e: TBaseEvent, requestData: RequestData) => Promise<void>;
  loadReducers: (r: Reducer<unknown>) => void;
};

export const moduleBackend: TModule<undefined, TReducersBackendExports> = {
  name: 'reducers',
  version: '0.0.1',
  description: 'Reducers module',
  dependencies: [],
  load: (args) => {
    const bep = new BackendEventProcessor();
    args.moduleExports({
      processEvent: async (e: TBaseEvent, requestData: RequestData) => {
        await bep.processEvent(e, requestData);
      },
      loadReducers: (r: Reducer<unknown>) => {
        bep.addReducer(r);
      },
    });
  },
};

export type { TEventPeriodic } from './lib/backendEventProcessor';
export { BackendEventProcessor } from './lib/backendEventProcessor';
