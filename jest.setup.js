const { TextDecoder, TextEncoder } = require('util');

/**
 * jsdom ships without TextEncoder/TextDecoder, and react-router reaches for
 * TextEncoder at import time. Any spec that renders something importing
 * react-router — which is most of ui-base, and so most of the module packages —
 * therefore dies before its first line, with a ReferenceError pointing at an
 * import rather than at anything the test does.
 *
 * Here rather than in each package: it is a gap in the environment, not a
 * property of any one package, and every React package that grows a spec would
 * otherwise rediscover it the same way.
 *
 * A no-op under the node environment, where Node has provided both as globals
 * for years.
 */
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});
