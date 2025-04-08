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

export { Dispatcher, BrowserDispatcher } from './lib/dispatcher';

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
} from './lib/front-hooks/context';
export type {
  TSharedDataHook,
  TCollabConfig,
  TYjsCollabConfig,
  TNoneCollabConfig,
} from './lib/front-hooks/context';

export type { TokenMethods } from './lib/front-hooks/ydocs';

export { getYDoc } from './lib/front-hooks/ydocs';

export { buildUserCss } from './lib/front-hooks/YjsCssStylesheet';

export { sharedDataToJson } from './lib/chunk';

export { EDITORS_YTEXT_YMAP_KEY } from './lib/yjs/YjsSharedEditor';
