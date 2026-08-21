/**
 * Which arrangement a given request belongs to.
 *
 * Ganymede answers on two at once. A browser on the local network reaches it
 * at `ganymede.<domain>` and gets back gateway hostnames like
 * `org-<uuid>.<domain>`; a browser coming through a tunnel reaches the same
 * process at `<public-host>/-/ganymede` and has to be given
 * `<public-host>/-/gw/org-<uuid>` instead, because `org-<uuid>.<public-host>`
 * is in no DNS and on no certificate.
 *
 * The two cannot be decided once at startup: the same Ganymede serves both at
 * the same time, and only the request says which one it is. So the answer is a
 * function of `req` — specifically of the host the request arrived on, which
 * is either inside the configured domain or is not.
 *
 * See @holistix-forge/types `public-routing` for the paths themselves, and
 * backend-engine's `public-origin` for the flag and the header handling.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import {
  isPublicTunnelEnabled,
  requestOrigin,
} from '@holistix-forge/backend-engine';
import {
  PUBLIC_GANYMEDE_PATH,
  isConfiguredHost,
  publicGatewayPath,
} from '@holistix-forge/types';

import { CONFIG } from '../config';
import { makeOrgGatewayHostname } from './url-helpers';

/**
 * The browser-visible authority of this deployment: `apollo.test:8443` on the
 * macOS layout, `app.example.com` on a server. FRONTEND_FQDN and not DOMAIN
 * because DOMAIN is absent in tests and FRONTEND_FQDN is required config, and
 * the two hold the same value everywhere both are set.
 */
export const configuredDomain = (): string => CONFIG.FRONTEND_FQDN;

/**
 * True when this request arrived on a hostname outside the configured domain
 * — which, with the flag on, means it came through a tunnel.
 */
export const isTunnelRequest = (req: Request): boolean => {
  if (!isPublicTunnelEnabled()) return false;

  const origin = requestOrigin(req);
  if (!origin) return false;

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }

  return !isConfiguredHost(host, configuredDomain());
};

/**
 * What to hand a browser so it can reach an organization's gateway.
 *
 * Despite the name — kept, because it is the field name in the API and in the
 * frontend that consumes it — the tunnel form is an authority *and a path*.
 * That is deliberate and it is why nothing downstream had to change: both
 * consumers build a URL out of it, `https://${gateway_hostname}` and
 * `wss://${gateway_hostname}/project/${id}`, and both stay correct when it
 * carries a prefix.
 */
export const gatewayHostnameFor = (
  organizationId: string,
  req: Request
): string => {
  if (!isTunnelRequest(req)) return makeOrgGatewayHostname(organizationId);

  const origin = requestOrigin(req);
  // isTunnelRequest already established there is one; this narrows the type.
  const host = origin ? new URL(origin).host : configuredDomain();

  return `${host}${publicGatewayPath(organizationId)}`;
};

/**
 * Where the frontend is, for a link this request will send a browser to.
 *
 * Every redirect Ganymede issues back into the application — the login page an
 * unauthenticated `/oauth/authorize` bounces to, the landing after a provider
 * callback, the magic-link failure page — is built from `APP_FRONTEND_URL`,
 * which is the local name. Following one of those from a tunnel takes the
 * visitor off the tunnel and onto a hostname their machine cannot resolve, so
 * signing in ends at a browser error page.
 */
export const frontendUrlFor = (req: Request): string => {
  if (!isTunnelRequest(req)) return CONFIG.APP_FRONTEND_URL;
  return requestOrigin(req) ?? CONFIG.APP_FRONTEND_URL;
};

/** The same, for a link that comes back to Ganymede itself. */
export const ganymedeUrlFor = (req: Request): string => {
  if (!isTunnelRequest(req)) return CONFIG.APP_GANYMEDE_URL;
  const origin = requestOrigin(req);
  return origin ? `${origin}${PUBLIC_GANYMEDE_PATH}` : CONFIG.APP_GANYMEDE_URL;
};

//
// The tunnel origin, made reachable from code that has no `req`
//

/**
 * The OAuth model is the one place that needs to know the host a request
 * arrived on and cannot be handed it.
 *
 * `getClient(clientId, secret)` is called by the `oauth2-server` library, from
 * inside its own authorize/token handling, with a signature this codebase does
 * not choose. The built-in client's registered redirect URI is
 * `CONFIG.APP_FRONTEND_URL` — the *local* frontend — so an authorization
 * started from a tunnel asks to be redirected somewhere the client has not
 * registered, and the library refuses with "redirect_uri does not match client
 * value". No token is issued and the app renders signed-in and empty, which is
 * the exact failure the comment at models/oauth.ts already describes from the
 * seed-data version of this problem.
 *
 * Threading the request through would mean changing a library-owned signature.
 * An async context is the alternative Node provides for precisely this: the
 * value is scoped to one request's async tree, so two requests arriving on two
 * different hostnames cannot see each other's — which a module-level variable
 * could not promise.
 */
const tunnelOrigin = new AsyncLocalStorage<string>();

/**
 * Middleware. Puts the request's own origin in scope for the whole request,
 * and only when that origin is a tunnel one — so on the configured domain
 * there is no value in scope and every decision below is unchanged.
 */
export const withTunnelOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const origin = isTunnelRequest(req) ? requestOrigin(req) : null;
  if (!origin) return next();
  tunnelOrigin.run(origin, () => next());
};

/**
 * Extra redirect URIs the built-in OAuth client should accept for the request
 * being handled: the tunnel origin, when there is one, and nothing otherwise.
 *
 * Safe to widen this way because the origin is not a parameter of the request
 * — it is the host the browser is *already* on. Handing a code back to the
 * page that asked for it is what the redirect URI check is for; it cannot be
 * pointed at an attacker without the attacker first owning the hostname the
 * user is browsing.
 */
export const tunnelRedirectUris = (): string[] => {
  const origin = tunnelOrigin.getStore();
  return origin ? [origin] : [];
};
