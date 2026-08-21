/**
 * Where someone last was, at each of the rail's two levels.
 *
 * The rail carries both — an organization's places, and a space's — and both
 * are meant to be usable from anywhere. But a page only ever names one of
 * them: an organization page is not inside a space, and the list of
 * organizations names neither. Read from the route alone, half the rail is
 * dead on every page, and dead exactly where someone is most likely to want
 * to go back to work.
 *
 * So the last of each is remembered. Not as a preference anyone sets, but as
 * the answer to "back to what": written on arriving somewhere, read from
 * everywhere the route is silent.
 *
 * The route's own parameters, deliberately, rather than ids resolved from
 * context — what is stored is what worked as a URL, so rebuilding it cannot
 * drift from the routing.
 *
 * Worth knowing: this outlives a session. Someone who signs in as another
 * user inherits the previous one's last places, and following one lands on a
 * page they may not be allowed to see — which the server refuses, as it
 * would for a pasted link. A wrong link, not a leak.
 */
export type TSpace = { owner: string; projectName: string };

const SPACE_KEY = 'holistix:last-space';
const ORGANIZATION_KEY = 'holistix:last-organization';

/** Storage that is allowed to be unavailable — private mode, full quota. */
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Losing the way back is a smaller failure than a rail that throws while
    // rendering.
  }
};

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

export const rememberSpace = (space: TSpace): void =>
  write(SPACE_KEY, JSON.stringify(space));

export const lastSpace = (): TSpace | undefined => {
  const raw = read(SPACE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    // Checked rather than trusted: this is storage a user can edit, and a
    // half-formed value here builds `/p/undefined/undefined/editor`.
    return typeof parsed?.owner === 'string' &&
      typeof parsed?.projectName === 'string'
      ? { owner: parsed.owner, projectName: parsed.projectName }
      : undefined;
  } catch (e) {
    return undefined;
  }
};

export const rememberOrganization = (organizationId: string): void =>
  write(ORGANIZATION_KEY, organizationId);

export const lastOrganization = (): string | undefined =>
  read(ORGANIZATION_KEY) || undefined;
