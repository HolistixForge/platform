/**
 * Routing the platform onto a single public hostname.
 *
 * The platform addresses its three pieces by name: the frontend at
 * `<domain>`, Ganymede at `ganymede.<domain>`, and one gateway per
 * organization at `org-<uuid>.<domain>`. That is a good arrangement and it
 * stays the default — but it needs wildcard DNS and a wildcard certificate for
 * `<domain>`, and a tunnel hands out neither. A Cloudflare quick tunnel gives
 * one `*.trycloudflare.com` name; a Tailscale funnel gives one machine name.
 * There is no `ganymede.` in front of either.
 *
 * So when the platform is reached on a name it does not own the whole subtree
 * of, the same three pieces are addressed by path instead:
 *
 *   https://<public-host>/                          the frontend
 *   https://<public-host>/-/ganymede/…              Ganymede
 *   https://<public-host>/-/gw/org-<uuid>/…         that organization's gateway
 *
 * `/-/` is the reservation. A single-page application owns every path under
 * `/` — that is what `try_files $uri /index.html` means — so platform routes
 * need a prefix the router will never mint, and one that reads as deliberate
 * rather than as a page nobody wrote. GitLab uses the same one, for the same
 * reason.
 *
 * These helpers live in `types` because all three sides have to agree on them:
 * the frontend builds the URLs, Ganymede hands out the gateway one, and
 * nginx's generated configuration terminates them.
 */

/** Prefix reserved for platform routes, never routed to the SPA. */
export const PUBLIC_ROUTE_PREFIX = '/-';

// Spelled out rather than built from the prefix, and the spec holds the two in
// step. A bundler is free to keep `"/-" + "/ganymede"` as a concatenation, and
// then the string never appears in the output — which matters because
// `tunnel.sh` greps the built frontend for it to tell a bundle that knows
// about path routing from one built before it existed. A warning that fires on
// a correct build is worse than no warning.

/** Where Ganymede answers when the platform is reached on one hostname. */
export const PUBLIC_GANYMEDE_PATH = '/-/ganymede';

/** Where the gateways answer, one path segment per organization. */
export const PUBLIC_GATEWAY_PATH = '/-/gw';

/**
 * The path an organization's gateway answers on, without a trailing slash.
 *
 * `org-<uuid>` and not just `<uuid>`, so that the path segment reads the same
 * as the hostname it stands in for and a log line from either arrangement says
 * the same thing.
 */
export const publicGatewayPath = (organizationId: string): string =>
  `${PUBLIC_GATEWAY_PATH}/org-${organizationId}`;

/**
 * Whether `host` is the configured domain or one of its subdomains.
 *
 * Both arguments are authorities as a browser writes them — `apollo.test:8443`,
 * `ganymede.apollo.test:8443` — because that is what a `Host` header and
 * `window.location.host` both contain, and dropping the port here is what made
 * the session cookie and the nginx `server_name` disagree once already.
 *
 * A false answer is the signal that the platform is being reached through
 * something in front of it, and that path routing applies.
 */
export const isConfiguredHost = (
  host: string | null | undefined,
  configuredDomain: string | null | undefined
): boolean => {
  if (!host || !configuredDomain) return false;

  const h = host.toLowerCase();
  const d = configuredDomain.toLowerCase();

  return h === d || h.endsWith(`.${d}`);
};
