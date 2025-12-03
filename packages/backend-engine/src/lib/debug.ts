//
//

import { EPriority, log } from '@holistix/log';

const DEV =
  process.env['NODE_ENV'] === 'development' ||
  process.env['NODE_ENV'] === 'test' ||
  process.env['DEVELOPMENT'] === 'development';

const DEBUG = parseInt(process.env.DEBUG_API || '1');

export const debug = (f: () => any) => {
  if (DEV || DEBUG) return f();
  return undefined;
};

export const development = (f: () => any) => {
  if (DEV) return f();
  return undefined;
};

log(EPriority.Debug, '', `environement: `, { DEV, DEBUG });
