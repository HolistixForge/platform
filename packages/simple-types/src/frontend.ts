// Frontend-only exports (React-dependent hooks)
export { useRegisterListener } from './lib/useRegisterListener';

// Re-export all backend-safe exports
export type {
  TJson,
  TJsonObject,
  TJsonArray,
  TJsonWithDate,
  TJsonWithUndefined,
  TStringMap,
} from './lib/simple-types';

export type {
  THeaders,
  TSerializableObject,
  TUri,
  TMyfetchRequest,
  TMyfetch,
} from './lib/my-fetch';

export { fullUri, serialize } from './lib/my-fetch';
export { makeUuid, makeShortUuid, isUuid, toUuid } from './lib/uuid';
export { secondAgo, inSeconds, isPassed, sleep, ONE_YEAR_MS } from './lib/date';
export { Listenable } from './lib/listenable';
