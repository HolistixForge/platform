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
export type { TUserPosition, TUserSelection } from './lib/Awareness';

export { YjsAwareness } from './lib/yjs/YjsAwareness';
export { YjsSharedTypes } from './lib/yjs/YjsSharedTypes';
export { YjsSharedEditor } from './lib/yjs/YjsSharedEditor';
export {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from './lib/yjs/load-save';

export { NoneSharedTypes } from './lib/none/NoneSharedTypes';
export { NoneAwareness } from './lib/none/NoneAwareness';

export { NoneSharedEditor } from './lib/SharedEditor';

export { SharedTypes } from './lib/SharedTypes';
export type { SharedMap, SharedArray } from './lib/SharedTypes';

export { sharedDataToJson } from './lib/sharedData';
export type { TValidSharedData } from './lib/sharedData';

export { EDITORS_YTEXT_YMAP_KEY } from './lib/yjs/YjsSharedEditor';

export { SharedEditor } from './lib/SharedEditor';
