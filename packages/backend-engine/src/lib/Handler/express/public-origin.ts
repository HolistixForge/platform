/**
 * Reaching the platform on a hostname it was never configured with.
 *
 * Every origin decision here — CORS, CSRF, the session cookie, the OAuth
 * redirect target — is made against ALLOWED_ORIGINS, a JSON array baked into
 * the environment file when the environment is created. That works while the
 * set of names the platform answers on is known in advance, and a tunnel is
 * exactly the case where it is not: a Cloudflare quick tunnel mints a fresh
 * `*.trycloudflare.com` name on every start, and a Tailscale funnel name is
 * per-machine. Re-writing the environment file and restarting Ganymede and
 * every gateway on each tunnel start would work, and it is a lot of moving
 * parts to keep in step for something with a much smaller rule at the bottom
 * of it:
 *
 *   a request whose `Origin` is the origin it was *sent to* is same-origin,
 *   and same-origin is not cross-site.
 *
 * A browser sets `Origin` itself and a page cannot forge it, so `Origin ===
 * <the origin this request arrived on>` cannot be produced by a cross-site
 * attacker: to make the browser send `Origin: https://x` to `https://x` the
 * attacker's page would have to *be* `https://x`. That makes the rule safe to
 * apply without knowing the hostname beforehand, which is the whole point.
 *
 * It is still behind a flag. Trusting the forwarded host means trusting
 * whatever sits in front, and an instance whose names are all known has
 * nothing to gain from it — so `PUBLIC_TUNNEL` is off unless an operator turns
 * it on, and with it off not one byte of behaviour changes.
 */

import type { Request } from 'express';

/**
 * Whether this instance may be reached on hostnames it was not configured
 * with. Read per call rather than captured at import: the tunnel scripts set
 * it in the environment file, and tests set it around a single case.
 */
export const isPublicTunnelEnabled = (): boolean => {
  const v = process.env.PUBLIC_TUNNEL;
  return v === '1' || v === 'true';
};

/**
 * The origin this request arrived on, as the browser would spell it.
 *
 * `req.protocol` and `req.hostname` are not enough. `req.hostname` drops the
 * port — Express strips it, and it always has — so on the macOS layout, where
 * nginx listens on 8443 because binding under 1024 needs root, an origin built
 * from it is `https://apollo.test` and matches nothing the browser ever sends.
 * The `Host` header carries the port, so that is what this reads.
 *
 * `X-Forwarded-Host` is preferred where present because nginx is asked to pass
 * `Host` through unchanged but a tunnel daemon in front of it may not: the
 * Cloudflare connector rewrites `Host` to the origin's own name and puts the
 * public one in `X-Forwarded-Host`.
 */
export const requestOrigin = (req: Request): string | null => {
  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const host = forwardedHost || firstHeaderValue(req.headers.host);
  if (!host) return null;

  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']);
  // Express already resolves `req.protocol` from X-Forwarded-Proto when
  // `trust proxy` is set, which both apps do. The header is read directly as
  // well so this helper is usable from a context that has no app settings.
  const proto = forwardedProto || req.protocol || 'https';

  return `${proto}://${host}`;
};

/**
 * `Origin` for a CORS request, and the origin part of `Referer` otherwise.
 *
 * The CSRF gate accepts either, because a same-site form navigation may send
 * only `Referer` — and a `Referer` carries a path, which has to come off
 * before it can be compared to an origin.
 */
export const declaredOrigin = (req: Request): string | null => {
  const origin = firstHeaderValue(req.headers.origin);
  if (origin && origin !== 'null') return origin;

  const referer = firstHeaderValue(req.headers.referer);
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

/**
 * True when this request was made from the very page it was sent to.
 *
 * Returns false with the flag off, so a deployment that has not opted in keeps
 * deciding on ALLOWED_ORIGINS alone.
 */
export const isSameOriginRequest = (req: Request): boolean => {
  if (!isPublicTunnelEnabled()) return false;

  const declared = declaredOrigin(req);
  if (!declared) return false;

  const arrived = requestOrigin(req);
  if (!arrived) return false;

  return declared === arrived;
};

//

const firstHeaderValue = (v: string | string[] | undefined): string | null => {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
};
