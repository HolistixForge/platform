/**
 * Catalogue resolution tests.
 *
 * This lookup is the allowlist. The gateway sends an id precisely so that the
 * decision of what image runs is made here, on the platform host, and not by
 * the tenant-facing process.
 */

import { resolveImage, UnknownImage, TCatalogueSource } from './catalogue';

const pinned = `holistixforge/ubuntu-terminal:24.04@sha256:${'c'.repeat(64)}`;

const source =
  (entries: Record<string, string>): TCatalogueSource =>
  async (organizationId, imageId) => {
    const reference = entries[`${organizationId}/${imageId}`];
    return reference ? { imageId, reference } : undefined;
  };

describe('resolveImage', () => {
  it('resolves an id the catalogue knows for that organization', async () => {
    const catalogue = source({ 'org-a/ubuntu:terminal': pinned });

    await expect(
      resolveImage(catalogue, 'org-a', 'ubuntu:terminal')
    ).resolves.toEqual({ imageId: 'ubuntu:terminal', reference: pinned });
  });

  it('refuses an id the catalogue does not know', async () => {
    // Never a passthrough: the whole reason the gateway sends an id rather
    // than a URI is that this lookup is the allowlist.
    const catalogue = source({});

    await expect(
      resolveImage(catalogue, 'org-a', 'attacker/image')
    ).rejects.toThrow(UnknownImage);
  });

  it('does not resolve another organization entry', async () => {
    const catalogue = source({ 'org-b/acme:etl': pinned });

    await expect(resolveImage(catalogue, 'org-a', 'acme:etl')).rejects.toThrow(
      UnknownImage
    );
  });

  it('refuses an entry that resolved but is not pinned to a digest', async () => {
    // A tenant image pinned only by tag is not the same artifact from one
    // start to the next, and this is the last place that can still say so.
    const catalogue = source({
      'org-a/acme:etl': 'registry.acme.example/etl:latest',
    });

    await expect(resolveImage(catalogue, 'org-a', 'acme:etl')).rejects.toThrow(
      'not pinned to a digest'
    );
  });

  it('refuses a digest that is the wrong length', async () => {
    const catalogue = source({
      'org-a/acme:etl': 'registry.acme.example/etl:1.0@sha256:abc',
    });

    await expect(resolveImage(catalogue, 'org-a', 'acme:etl')).rejects.toThrow(
      'not pinned to a digest'
    );
  });
});
