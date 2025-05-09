export type {
  _PositionAwareness,
  _AwarenessListenerArgs,
  _AwarenessState,
  _AwarenessStates,
  TAwarenessUser,
  E_PositionReference,
  AwarenessEventArgs,
} from './lib/awareness-types';

export { Awareness } from './lib/Awareness';

export { YjsAwareness } from './lib/yjs/YjsAwareness';
export { YjsSharedTypes } from './lib/yjs/YjsSharedTypes';
export { YjsSharedEditor } from './lib/yjs/YjsSharedEditor';
export {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from './lib/yjs/load-save';

export { NoneSharedTypes } from './lib/none/NoneSharedTypes';
export { NoneAwareness } from './lib/none/NoneAwareness';

export { SharedTypes } from './lib/SharedTypes';
export type { SharedMap, SharedArray } from './lib/SharedTypes';

export { compileChunks } from './lib/chunk';
export type { TValidSharedData, TCollaborativeChunk } from './lib/chunk';

export { Reducer } from './lib/reducer';
export type { ReduceArgs } from './lib/reducer';

export { BackendEventProcessor } from './lib/backendEventProcessor';

export {
  FrontendDispatcher,
  JitterDispatcher,
} from './lib/frontend/frontendDispatcher';
export type { FrontendEventSequence } from './lib/frontend/frontendEventSequence';

export type {
  TEventUserLeave,
  TEventPeriodic,
  TCollabNativeEvent,
} from './lib/events';

//

export {
  CollaborativeContext,
  useAwareness,
  useAwarenessListenData,
  useSharedData,
  useDispatcher,
  useExtraContext,
  useBindEditor,
  useEventSequence,
} from './lib/frontend/context';
export type {
  TSharedDataHook,
  TCollabConfig,
  TYjsCollabConfig,
  TNoneCollabConfig,
  TCollaborationContext,
} from './lib/frontend/context';

export type { TokenMethods } from './lib/frontend/ydocs';

export { getYDoc } from './lib/frontend/ydocs';

export { buildUserCss } from './lib/frontend/YjsCssStylesheet';

export { sharedDataToJson } from './lib/chunk';

export { EDITORS_YTEXT_YMAP_KEY } from './lib/yjs/YjsSharedEditor';

export { MockCollaborativeContext } from './lib/frontend/mockCollaborativeContext';
