import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

/**
 * jsdom does not provide TextEncoder/TextDecoder, and react-router reaches for
 * TextEncoder at import time — so without this every spec that renders a route
 * fails before its first line runs, with a ReferenceError pointing at an import
 * rather than at anything the test does.
 *
 * Node's own implementations, which is what a browser would have given us.
 */
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});
