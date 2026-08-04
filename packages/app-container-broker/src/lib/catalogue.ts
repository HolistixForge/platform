import { TResolvedImage } from './types';

export class UnknownImage extends Error {}

/**
 * Where the broker looks up what an `image_id` actually means.
 *
 * Injected so the resolution source can move — a static built-in list while
 * only curated images exist, Ganymede once organizations register their own —
 * without the security-relevant part of the broker changing shape.
 */
export type TCatalogueSource = (
  projectId: string,
  imageId: string
) => Promise<TResolvedImage | undefined>;

const DIGEST_PINNED = /^[^\s]+@sha256:[0-9a-f]{64}$/;

/**
 * Resolve an `image_id` to the reference a runtime may be handed.
 *
 * Two refusals, both deliberate:
 *
 * - An id the catalogue does not know is an error, never a passthrough. The
 *   whole reason the gateway sends an id rather than a URI is that this lookup
 *   is the allowlist.
 * - An entry without a digest is rejected even though it resolved. A tenant
 *   image on shared infrastructure that is only pinned by tag is not the same
 *   artifact from one start to the next, and the broker is the last place that
 *   can still say so.
 */
export const resolveImage = async (
  source: TCatalogueSource,
  projectId: string,
  imageId: string
): Promise<TResolvedImage> => {
  const resolved = await source(projectId, imageId);

  if (!resolved) {
    throw new UnknownImage(
      `image ${imageId} is not in the catalogue for project ${projectId}`
    );
  }

  if (!DIGEST_PINNED.test(resolved.reference)) {
    throw new UnknownImage(
      `image ${imageId} is not pinned to a digest and will not be started`
    );
  }

  // A tenant image — one that needs a project credential — is legal only under
  // the GitHub organization the project is linked to. Ganymede has already
  // applied that rule; re-checking here is cheap and catches a mistake in its
  // logic at the point where the mistake would actually pull something.
  if (resolved.pullToken) {
    const owner = resolved.githubOrganization?.toLowerCase();
    if (!owner) {
      throw new UnknownImage(
        `image ${imageId} carries a pull token but names no GitHub organization`
      );
    }
    if (!resolved.reference.toLowerCase().startsWith(`ghcr.io/${owner}/`)) {
      throw new UnknownImage(
        `image ${imageId} is outside ghcr.io/${owner}/ and will not be started`
      );
    }
  }

  return resolved;
};

/**
 * Catalogue backed by Ganymede.
 *
 * Ganymede owns the project catalogue and the credential wallet, so it is the
 * one place that can both say "this project may run this image" and mint a
 * token to fetch it. Asking it rather than trusting the gateway keeps the
 * gateway out of the decision; having it mint the token rather than handing
 * over the stored PAT keeps the tenant's GitHub credential off this host.
 */
export const ganymedeCatalogue =
  (endpoint: string, token: string): TCatalogueSource =>
  async (projectId, imageId) => {
    const url =
      `${endpoint.replace(/\/$/, '')}/internal/projects/` +
      `${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageId)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(
        `catalogue lookup failed (${response.status}) for ${imageId}`
      );
    }

    const body = (await response.json()) as {
      imageId: string;
      reference: string;
      pull_token?: string;
      github_organization?: string;
    };
    return {
      imageId: body.imageId,
      reference: body.reference,
      pullToken: body.pull_token,
      githubOrganization: body.github_organization,
    };
  };
