export type { TJson } from './lib/simple-types';

export type {
  THeaders,
  TSerializableObject,
  TUri,
  TMyfetchRequest,
  TMyfetch,
} from './lib/my-fetch';

export { fullUri, serialize } from './lib/my-fetch';

export { makeUuid, makeShortUuid } from './lib/uuid';

export { secondAgo, inSeconds, isPassed, sleep, ONE_YEAR_MS } from './lib/date';
