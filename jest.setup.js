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
/**
 * The same gap, for `structuredClone`.
 *
 * Node has had it as a global since 17, but jsdom's sandbox does not expose
 * it, so any code under test that clones — the whiteboard reducer does it on
 * every graph-view write — dies with a ReferenceError inside the code rather
 * than in the test. The reducers are the part of the platform least tied to
 * the DOM and the part most worth testing, so this would be rediscovered by
 * every spec that reaches one.
 *
 * A JSON round-trip, and deliberately not `v8.serialize`. The v8 pair is the
 * real structured-clone algorithm, but it builds its objects in Node's realm,
 * and jsdom runs the code under test in its own. Yjs identifies a plain
 * object by `constructor === Object`, so a clone from the other realm fails
 * that check and every `sharedData.set` of a cloned value throws "Unexpected
 * content type" — inside Yjs, several frames away from the cause. Measured on
 * the whiteboard reducer, which clones a graph view on every write.
 *
 * `JSON.parse` here is the sandbox's, so the clone lands in the right realm.
 * The cost is that a Date or a Map would not survive; shared data is `TJson`
 * by contract, so for the code this serves there is nothing to lose.
 */
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
  structuredClone:
    globalThis.structuredClone ??
    ((value) => JSON.parse(JSON.stringify(value))),
});
