//
//

import { log } from '@monorepo/log';

const DEV =
  process.env['NODE_ENV'] === 'development' ||
  process.env['NODE_ENV'] === 'test' ||
  process.env['DEVELOPMENT'] === 'development';

const DEBUG = parseInt(process.env.DEBUG_API || '1');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debug = (f: () => any) => {
  if (DEV || DEBUG) return f();
  return undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const development = (f: () => any) => {
  if (DEV) return f();
  return undefined;
};

log(7, '', `environement: `, { DEV, DEBUG });
