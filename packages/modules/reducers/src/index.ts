import { TModule } from '@holistix-forge/module';
import {
  TJson,
  TJsonWithDate,
  TStringMap,
} from '@holistix-forge/simple-types';
import { BackendEventProcessor } from './lib/backendEventProcessor';

/**
 * Base Event Type
 *
 * systemEvent: Optional flag to mark events that should NOT rearm project activity timer
 * - undefined/false: User-initiated events (rearm timer on activity)
 * - true: System/internal events (don't affect activity tracking)
 *
 * Examples:
 * - User events: { type: 'tabs:add-tab', ... } ← rearms timer
 * - System events: { type: 'reducers:periodic', systemEvent: true } ← doesn't rearm
 */
export type TBaseEvent = { 
  type: string; 
  systemEvent?: boolean;
  [key: string]: TJsonWithDate | undefined;
};

export abstract class RequestData {
  abstract get ip(): string;
  abstract get user_id(): string;
  abstract get jwt(): TJson;
  abstract get headers(): TStringMap;
  /**
   * Project ID for multi-project architecture
   * Required when using registry mode
   */
  abstract get project_id(): string | undefined;
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

// System events (infrastructure-level events)
export type { TEventPeriodic } from './lib/system-events';

// Event processor
export { BackendEventProcessor } from './lib/backendEventProcessor';
