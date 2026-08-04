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
  organizationId: string,
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
  organizationId: string,
  imageId: string
): Promise<TResolvedImage> => {
  const resolved = await source(organizationId, imageId);

  if (!resolved) {
    throw new UnknownImage(
      `image ${imageId} is not in the catalogue for organization ${organizationId}`
    );
  }

  if (!DIGEST_PINNED.test(resolved.reference)) {
    throw new UnknownImage(
      `image ${imageId} is not pinned to a digest and will not be started`
    );
  }

  return resolved;
};

/**
 * Catalogue backed by Ganymede.
 *
 * Ganymede owns organization membership and, once tenants register images, the
 * per-organization catalogue. Asking it rather than trusting the gateway is
 * what keeps the gateway out of the decision.
 */
export const ganymedeCatalogue =
  (endpoint: string, token: string): TCatalogueSource =>
  async (organizationId, imageId) => {
    const url =
      `${endpoint.replace(/\/$/, '')}/internal/organizations/` +
      `${encodeURIComponent(organizationId)}/images/${encodeURIComponent(
        imageId
      )}`;

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
    };
    return { imageId: body.imageId, reference: body.reference };
  };
