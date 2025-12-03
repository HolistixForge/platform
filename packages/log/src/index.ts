// Backend-safe exports only (no React dependencies)
export {
  EPriority,
  Logger,
  log,
  error,
  type LoggerInitOptions,
} from './lib/log';

export {
  Exception,
  UserException,
  ForbiddenException,
  NotFoundException,
  SystemException,
  UnknownException,
} from './lib/exceptions';
export type { OneError } from './lib/exceptions';
