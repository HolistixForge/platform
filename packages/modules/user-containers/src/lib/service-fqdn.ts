/**
 * The names a container's services are published under.
 *
 * A container publishes one or more HTTP services, and each gets a name of its
 * own because each *behaves* as if it owns `/`. That is not a preference: the
 * Jupyter image is started with `JUPYTERHUB_BASE_URL="/"` and an OAuth
 * callback of `https://<its own name>/oauth_callback`, and an arbitrary
 * catalogue image has no base-path setting to offer at all. A path prefix
 * would break them; a hostname each does not.
 *
 * The question this file answers is how *deep* those names go.
 *
 *   Before: <service>.uc-<id>.org-<uuid>.<domain>     three labels deep
 *   Now:    uc-<id>--<service>.org-<uuid>.<domain>    two
 *
 * Depth is the whole cost, because a TLS wildcard matches exactly one label
 * and `*.*.<domain>` is not a name that can be issued. At three levels every
 * *container* needs its own certificate, minted the moment someone presses a
 * button — locally that is free with mkcert, and on the internet it is an ACME
 * issuance per container, against Let's Encrypt's 50-certificates-per-week
 * budget and a DNS-01 round trip each time. At two levels the deepest name is
 * `uc-<id>.org-<uuid>.<domain>`, so one `*.org-<uuid>.<domain>` per
 * organization covers every container and every service it will ever have.
 * Organizations are few and long-lived; containers are neither.
 *
 * Why the container comes first and the service after, when a service name
 * reads more naturally in front: a label whose third and fourth characters are
 * `--` is reserved by IDNA (RFC 5891 §4.2.3.1) for A-labels like `xn--`. Any
 * two-character service name would land exactly there. Leading with the fixed
 * `uc-` token makes positions three and four `-` and the first character of an
 * id, always, so the rule cannot be tripped by anything a user types.
 */

/** Separator between the parts of a service label. */
export const SERVICE_LABEL_SEPARATOR = '--';

/** A DNS label is at most 63 octets (RFC 1035 §2.3.4). */
export const MAX_DNS_LABEL_LENGTH = 63;

/** Service names that mean "the container itself" rather than a named service. */
const MAIN_SERVICE_NAMES = ['', 'main', 'default'];

/**
 * One part of a hostname label, reduced to what DNS accepts.
 *
 * Lowercase because hostnames are case-insensitive and nginx compares
 * `server_name` in lowercase — a name that differs only in case matches
 * nothing and falls through to the catch-all, which is the failure mode this
 * whole area keeps producing.
 */
export const slugifyLabelPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The leftmost label of a container's own name. Unchanged, and deliberately
 * so: it is what the base FQDN and the auth guard's `__auth/callback` are
 * already built from, and what any issued certificate already covers.
 *
 * The doubled prefix — `uc-` in front of an id that itself starts `uc_` — is
 * how these names have always read. It is kept rather than tidied because it
 * appears in certificates on disk and in nginx server blocks written at
 * runtime, and a cosmetic change there costs a reissue and a reload for
 * nothing.
 */
export const containerLabel = (containerId: string): string =>
  `uc-${containerId}`;

/**
 * The leftmost label for one service of a container.
 *
 * `parts` are the qualifiers, in the order they should read after the
 * container: the service name, and whatever else identifies it. They are
 * slugified, empty ones dropped, and the result trimmed to fit a DNS label —
 * from the *end*, so the container id, which is what routing and the
 * certificate depend on, is never the thing that gets cut.
 */
export const serviceLabel = (
  containerId: string,
  parts: (string | undefined | null)[]
): string => {
  const head = containerLabel(containerId);

  const slugged = parts
    .map((p) => slugifyLabelPart(p ?? ''))
    .filter((p) => p.length > 0);

  if (slugged.length === 0) return head;

  const label = [head, ...slugged].join(SERVICE_LABEL_SEPARATOR);
  if (label.length <= MAX_DNS_LABEL_LENGTH) return label;

  // Over budget. Trim the tail rather than refuse: a name that is too long is
  // a name nginx will not serve, and a truncated one still routes because the
  // gateway is told the same string it publishes. Losing the end of a service
  // name is a cosmetic defeat; losing the container id would be a functional
  // one.
  return label.slice(0, MAX_DNS_LABEL_LENGTH).replace(/-+$/, '');
};

/** Whether a service name means "the container itself". */
export const isMainService = (serviceName: string | undefined): boolean =>
  MAIN_SERVICE_NAMES.includes((serviceName ?? '').toLowerCase());

/**
 * The full name one service is published under.
 *
 * The main service keeps the bare container FQDN, so nothing that already
 * points at a container — the auth guard callback, an issued certificate, a
 * link somebody saved — moves.
 */
export const serviceFqdn = (args: {
  containerId: string;
  organizationId: string;
  domain: string;
  serviceName?: string;
  /** Extra qualifiers between the container and the service, e.g. a space. */
  qualifiers?: (string | undefined | null)[];
}): string => {
  const { containerId, organizationId, domain, serviceName, qualifiers } = args;

  const label = isMainService(serviceName)
    ? containerLabel(containerId)
    : serviceLabel(containerId, [...(qualifiers ?? []), serviceName]);

  return `${label}.org-${organizationId}.${domain}`;
};
