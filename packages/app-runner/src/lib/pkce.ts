import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE (RFC 7636), the client half.
 *
 * A runner on someone's machine cannot hold a secret — anything shipped with
 * it is readable by whoever has the machine — so it proves itself by producing
 * the verifier behind a challenge it sent at the start of the flow. The
 * verifier is generated fresh per attempt and never leaves the process; only
 * its hash travels. An authorization code intercepted on the way back is then
 * worth nothing to whoever caught it.
 */

export type TPkcePair = {
  /** Sent only to the token endpoint, at the end. */
  verifier: string;
  /** Sent to the authorize endpoint, at the start. */
  challenge: string;
  /** Always S256. `plain` sends the verifier itself, which defeats the point. */
  method: 'S256';
};

/**
 * 32 random bytes, base64url — 43 characters, the shortest length RFC 7636
 * allows and already 256 bits of entropy.
 */
export const createPkcePair = (): TPkcePair => {
  const verifier = randomBytes(32).toString('base64url');

  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    method: 'S256',
  };
};

/**
 * The `state` parameter: not PKCE, and not a substitute for it.
 *
 * PKCE binds the code to this process; state binds the *callback* to this
 * request, so a browser arriving at the loopback server with a code from some
 * other flow is refused rather than exchanged.
 */
export const createState = (): string => randomBytes(16).toString('base64url');
