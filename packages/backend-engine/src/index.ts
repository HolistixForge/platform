// Express setup helpers
export {
  setupBasicExpressApp,
  setupErrorsHandler,
} from './lib/Handler/express/app-setup';
export type { BasicExpressAppOptions } from './lib/Handler/express/app-setup';

export { setupValidator } from './lib/Handler/express/openapi-validator';
export { respond } from './lib/Handler/express/responses';

export type { TStart } from './lib/Handler/express/types';

// Database
export { PostgreSQL } from './lib/databases/sql/postgres/PostgreSQL';
export { Connections } from './lib/databases/sql/Connections';
export type { TSqlApi, TConnections } from './lib/databases/sql/Connections';

// JWT and auth utilities
export { jwtPayload, generateJwtToken } from './lib/InputSource/Jwt';
export { makeHmacToken } from './lib/InputSource/HmacToken';

// Utilities
export { myfetch } from './lib/utils/fetch';
export type { MyfetchResponse } from './lib/utils/fetch';
export { development } from './lib/debug';

// Response types (needed by respond function)
export type { TCookie } from './lib/Response/Response';

// Jaeger logging (optional)
export { setupJaegerLog } from './lib/Logs/jaeger';
