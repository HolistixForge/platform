/**
 * The last space someone was in.
 *
 * The rail carries two levels — an organization's places, and a space's — and
 * both are meant to be usable from anywhere. But an organization page is not
 * inside a space, so there is no space for its entries to point at, and they
 * would be dead exactly where someone is most likely to want to go back to
 * work.
 *
 * So the last one is remembered. Not as a preference the user sets, but as
 * the answer to "back to what": it is written on entering a space and read
 * from everywhere else.
 *
 * The route's own parameters, deliberately, rather than ids resolved from
 * context — what is stored is what worked as a URL, so rebuilding it cannot
 * drift from the routing.
 */
export type TSpace = { owner: string; projectName: string };

const KEY = 'holistix:last-space';

export const rememberSpace = (space: TSpace): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(space));
  } catch (e) {
    // Private browsing, a full quota, a locked-down profile. Losing the way
    // back is a smaller failure than a rail that throws while rendering.
  }
};

export const lastSpace = (): TSpace | undefined => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
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
