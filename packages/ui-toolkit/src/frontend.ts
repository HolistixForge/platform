// Frontend-only exports (React-dependent)
export { useScript } from './lib/script-tag/script-tag';
export {
  showDebugComponent,
  useDebugComponent,
  DebugComponentKeyboardShortcut,
} from './lib/useDebugComponent';

// Re-export all backend-safe exports
export { getCookie, getCookies } from './lib/cookies/cookies';
export { JwtPayload, b64_to_utf8 } from './lib/jwt/jwt';
export { clientXY } from './lib/mouse-event/mouse-event';
export {
  insertScript,
  insertScriptsSynchronously,
} from './lib/script-tag/script-tag';
export { injectCssClass } from './lib/css/inject';
