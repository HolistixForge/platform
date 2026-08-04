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
  async (projectId, imageId) => {
    const reference = entries[`${projectId}/${imageId}`];
    return reference ? { imageId, reference } : undefined;
  };

describe('resolveImage', () => {
  it('resolves an id the catalogue knows for that project', async () => {
    const catalogue = source({ 'project-a/ubuntu:terminal': pinned });

    await expect(
      resolveImage(catalogue, 'project-a', 'ubuntu:terminal')
    ).resolves.toEqual({ imageId: 'ubuntu:terminal', reference: pinned });
  });

  it('refuses an id the catalogue does not know', async () => {
    // Never a passthrough: the whole reason the gateway sends an id rather
    // than a URI is that this lookup is the allowlist.
    const catalogue = source({});

    await expect(
      resolveImage(catalogue, 'project-a', 'attacker/image')
    ).rejects.toThrow(UnknownImage);
  });

  it('does not resolve another project entry', async () => {
    const catalogue = source({ 'project-b/acme:etl': pinned });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).rejects.toThrow(UnknownImage);
  });

  it('refuses an entry that resolved but is not pinned to a digest', async () => {
    // A tenant image pinned only by tag is not the same artifact from one
    // start to the next, and this is the last place that can still say so.
    const catalogue = source({
      'project-a/acme:etl': 'registry.acme.example/etl:latest',
    });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).rejects.toThrow('not pinned to a digest');
  });

  it('refuses a tenant image outside its linked GitHub organization', async () => {
    // Ganymede has already applied this rule. Re-checking catches a mistake in
    // that logic at the point where it would actually pull something.
    const catalogue: TCatalogueSource = async (_projectId, imageId) => ({
      imageId,
      reference: `ghcr.io/globex/secret:1.0@sha256:${'a'.repeat(64)}`,
      pullToken: 'project-scoped-token',
      githubOrganization: 'acme',
    });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).rejects.toThrow('outside ghcr.io/acme/');
  });

  it('refuses a tenant image that names no organization', async () => {
    const catalogue: TCatalogueSource = async (_projectId, imageId) => ({
      imageId,
      reference: `ghcr.io/acme/etl:1.0@sha256:${'a'.repeat(64)}`,
      pullToken: 'project-scoped-token',
    });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).rejects.toThrow('names no GitHub organization');
  });

  it('accepts a tenant image under its linked organization', async () => {
    const catalogue: TCatalogueSource = async (_projectId, imageId) => ({
      imageId,
      reference: `ghcr.io/acme/etl:1.0@sha256:${'a'.repeat(64)}`,
      pullToken: 'project-scoped-token',
      githubOrganization: 'Acme',
    });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).resolves.toMatchObject({ imageId: 'acme:etl' });
  });

  it('applies no organization rule to a built-in image', async () => {
    // Ours, no tenant credential — there is no linked organization to check.
    const catalogue = source({ 'project-a/ubuntu:terminal': pinned });

    await expect(
      resolveImage(catalogue, 'project-a', 'ubuntu:terminal')
    ).resolves.toMatchObject({ imageId: 'ubuntu:terminal' });
  });

  it('refuses a digest that is the wrong length', async () => {
    const catalogue = source({
      'project-a/acme:etl': 'registry.acme.example/etl:1.0@sha256:abc',
    });

    await expect(
      resolveImage(catalogue, 'project-a', 'acme:etl')
    ).rejects.toThrow('not pinned to a digest');
  });
});
