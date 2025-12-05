// Backend-safe exports only (no React dependencies)
export { getCookie, getCookies } from './lib/cookies/cookies';

export { JwtPayload, b64_to_utf8 } from './lib/jwt/jwt';

export { clientXY } from './lib/mouse-event/mouse-event';

export {
  insertScript,
  insertScriptsSynchronously,
} from './lib/script-tag/script-tag-core';

export { injectCssClass } from './lib/css/inject';
