/**
 * `fetch failed`, said usefully.
 *
 * Node's fetch reports every transport failure with those two words and hides
 * the reason on `error.cause`. On a runner that matters more than usual: the
 * only thing it does is talk to a platform it was pointed at, so a transport
 * failure *is* the failure, and the person reading it is on their own laptop
 * with no server log to check.
 *
 * Measured, enrolling against a development platform: `holistix-runner status`
 * printed `fetch failed` and stopped. The cause was
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — a `mkcert` certificate, whose authority
 * node does not carry — and finding that took reading the source and
 * re-issuing the request by hand. The remedy is one environment variable, and
 * nothing said so.
 */

/** Node's TLS verification failures, and what each one means to do about it. */
const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

const causeCode = (error: unknown): string | undefined => {
  const cause = (error as { cause?: unknown })?.cause;
  const code = (cause as { code?: unknown })?.code;
  return typeof code === 'string' ? code : undefined;
};

/**
 * A sentence to add to a failed request, or nothing.
 *
 * Nothing rather than a guess: a message that explains the wrong thing is
 * worse than one that explains nothing, because it sends somebody looking
 * where the fault is not.
 */
export const explainFetchFailure = (
  error: unknown,
  url: string
): string | undefined => {
  const code = causeCode(error);
  if (!code) return undefined;

  if (TLS_CODES.has(code)) {
    return (
      `${code}: ${url} presents a certificate node does not trust. ` +
      'A development platform is signed by a local authority — point node at ' +
      'it with NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem". ' +
      'Use that path and not a rootCA.pem sitting in the repository: those ' +
      'are untracked copies somebody exported once, and go stale when the ' +
      'authority is reissued.'
    );
  }

  if (code === 'CERT_HAS_EXPIRED') {
    return `${code}: the certificate at ${url} has expired.`;
  }

  if (code === 'ECONNREFUSED') {
    return `${code}: nothing is listening at ${url}.`;
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return (
      `${code}: ${url} does not resolve. A .test or .local name needs the ` +
      'resolver the platform installs.'
    );
  }

  return `${code}.`;
};

/**
 * The real one, captured before anything replaces it.
 *
 * `main.ts` installs `fetchWithHint` as `globalThis.fetch`, and a bare `fetch`
 * inside the wrapper is resolved on the global *at call time* — so it would
 * find the wrapper and call itself. Measured: `Exception in
 * PromiseRejectCallback`, on every command, including the ones that had no
 * network problem at all. Bound at module load, which is before that
 * assignment runs.
 */
const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

/**
 * `fetch`, with the reason attached when it fails.
 *
 * The original error is kept as `cause` so nothing downstream loses it: the
 * loop already distinguishes a revocation from an outage, and that decision
 * reads the response, not this.
 */
export const fetchWithHint: typeof fetch = async (input, init) => {
  try {
    return await nativeFetch(input, init);
  } catch (error) {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const explanation = explainFetchFailure(error, url);
    if (!explanation) throw error;

    throw new Error(`${(error as Error).message} — ${explanation}`, {
      cause: error,
    });
  }
};
