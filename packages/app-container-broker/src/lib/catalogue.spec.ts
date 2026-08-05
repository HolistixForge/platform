/**
 * Catalogue resolution tests.
 *
 * This lookup is the allowlist. The gateway sends an id precisely so that the
 * decision of what image runs is made here, on the platform host, and not by
 * the tenant-facing process.
 */

import {
  resolveImage,
  UnknownImage,
  TCatalogueSource,
  ganymedeCatalogue,
} from './catalogue';

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

/**
 * How the broker authenticates to Ganymede.
 *
 * Its `/internal/…` routes are guarded by `authenticateGatewayToken`, which
 * reads one header and no other. Sending the wrong one is indistinguishable
 * from sending nothing — both answer 401 — so the failure arrives here as
 * "catalogue unavailable" and reads as Ganymede's fault.
 *
 * There is no contract test between the two services, so this is the only
 * place the header name is pinned on this side. It was wrong until a real
 * Ganymede was stood up and asked.
 */
describe('ganymedeCatalogue — the request it makes', () => {
  const captured: { url?: string; headers?: Record<string, string> } = {};

  const stubFetch = (status: number, body: unknown = {}) =>
    jest.fn(
      async (url: string, init?: { headers?: Record<string, string> }) => {
        captured.url = url;
        captured.headers = init?.headers;
        return {
          status,
          ok: status >= 200 && status < 300,
          json: async () => body,
        } as unknown as Response;
      }
    );

  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it('authenticates with X-Gateway-Token, the header Ganymede reads', async () => {
    global.fetch = stubFetch(200, {
      imageId: 'acme:etl',
      reference: `ghcr.io/acme/etl@sha256:${'a'.repeat(64)}`,
    }) as unknown as typeof fetch;

    await ganymedeCatalogue('http://ganymede:6870', 'gw-jwt')(
      'project-1',
      'acme:etl'
    );

    expect(captured.headers).toEqual({ 'X-Gateway-Token': 'gw-jwt' });
  });

  it('never sends the token as a bearer', async () => {
    // Which is what it did, and 401 was the same answer as sending nothing.
    global.fetch = stubFetch(200, {
      imageId: 'acme:etl',
      reference: `ghcr.io/acme/etl@sha256:${'a'.repeat(64)}`,
    }) as unknown as typeof fetch;

    await ganymedeCatalogue('http://ganymede:6870', 'gw-jwt')(
      'project-1',
      'acme:etl'
    );

    expect(captured.headers?.['Authorization']).toBeUndefined();
  });

  it('asks for the project and image it was given, both encoded', async () => {
    // `acme:etl` carries a colon, which is a path delimiter if left raw.
    global.fetch = stubFetch(404) as unknown as typeof fetch;

    await ganymedeCatalogue('http://ganymede:6870/', 'gw-jwt')(
      'project-1',
      'acme:etl'
    );

    expect(captured.url).toBe(
      'http://ganymede:6870/internal/projects/project-1/images/acme%3Aetl'
    );
  });
});
