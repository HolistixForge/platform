/**
 * Image catalogue tests.
 *
 * Once tenants can supply images, `image_id` stops being a label and becomes an
 * allowlist key — a runner is handed an id and resolves it here. These tests
 * pin the three properties that key depends on: projects cannot see each
 * other's images, cannot take over a built-in id, and cannot register an image
 * that is not pinned to an exact artifact.
 *
 * Scoped by project, not by organization, because that is where the pull
 * credential lives — `credential_shares.share_scope = 'project'`.
 */

import { ContainerImageRegistry, imageReference } from './image-registry';
import { TContainerImageDefinition } from './container-image';

const builtin: TContainerImageDefinition = {
  imageId: 'ubuntu:terminal',
  imageName: 'Ubuntu Terminal',
  imageUri: 'holistixforge/ubuntu-terminal',
  imageTag: '24.04',
  category: 'utility',
};

const tenantImage = (
  overrides: Partial<TContainerImageDefinition> = {}
): TContainerImageDefinition => ({
  imageId: 'acme:etl',
  imageName: 'Acme ETL',
  imageUri: 'ghcr.io/acme/etl',
  imageTag: '1.4.0',
  imageSha256: 'a'.repeat(64),
  ...overrides,
});

describe('ContainerImageRegistry', () => {
  let registry: ContainerImageRegistry;

  beforeEach(() => {
    registry = new ContainerImageRegistry();
    registry.register([builtin]);
  });

  describe('built-in images', () => {
    it('resolves for any project', () => {
      expect(registry.get('ubuntu:terminal', 'project-a')).toEqual(builtin);
      expect(registry.get('ubuntu:terminal', 'project-b')).toEqual(builtin);
      expect(registry.get('ubuntu:terminal')).toEqual(builtin);
    });

    it('rejects a duplicate registration', () => {
      expect(() => registry.register([builtin])).toThrow('already registered');
    });
  });

  describe('project images', () => {
    it('resolves only for the project that registered it', () => {
      registry.registerForProject('project-a', [tenantImage()]);

      expect(registry.get('acme:etl', 'project-a')).toMatchObject({
        imageId: 'acme:etl',
      });
      expect(registry.get('acme:etl', 'project-b')).toBeUndefined();
    });

    it('is invisible without a project', () => {
      // getAll() with no scope is what a caller that forgot to pass one would
      // reach for. It must degrade to the built-in catalogue, never to
      // "everything anyone registered".
      registry.registerForProject('project-a', [tenantImage()]);

      expect(registry.get('acme:etl')).toBeUndefined();
      expect(registry.getAll()).toEqual([builtin]);
    });

    it('does not leak one project catalogue into another', () => {
      // Stricter than organization scoping: this also stops a leak between two
      // projects of the same organization.
      registry.registerForProject('project-a', [tenantImage()]);
      registry.registerForProject('project-b', [
        tenantImage({ imageId: 'globex:sim' }),
      ]);

      expect(registry.getAll('project-a').map((i) => i.imageId)).toEqual([
        'ubuntu:terminal',
        'acme:etl',
      ]);
      expect(registry.getAll('project-b').map((i) => i.imageId)).toEqual([
        'ubuntu:terminal',
        'globex:sim',
      ]);
    });

    it('refuses to shadow a built-in id', () => {
      // Otherwise a user picking "Ubuntu Terminal" from the catalogue would
      // silently start whatever the project registered under that id.
      expect(() =>
        registry.registerForProject('project-a', [
          tenantImage({ imageId: 'ubuntu:terminal' }),
        ])
      ).toThrow('cannot be overridden');

      expect(registry.get('ubuntu:terminal', 'project-a')).toEqual(builtin);
    });

    it('refuses an image that is not pinned by digest', () => {
      expect(() =>
        registry.registerForProject('project-a', [
          tenantImage({ imageSha256: undefined }),
        ])
      ).toThrow('must be pinned by digest');
    });

    it('refuses a duplicate id within the same project', () => {
      registry.registerForProject('project-a', [tenantImage()]);
      expect(() =>
        registry.registerForProject('project-a', [tenantImage()])
      ).toThrow('already registered for project');
    });

    it('requires a project id', () => {
      expect(() => registry.registerForProject('', [tenantImage()])).toThrow(
        'projectId is required'
      );
    });

    it('drops a catalogue on clearProject', () => {
      // Gateway pool containers are reallocated between organizations; one that
      // keeps serving the previous tenant's catalogue is a leak, not staleness.
      registry.registerForProject('project-a', [tenantImage()]);
      registry.clearProject('project-a');

      expect(registry.get('acme:etl', 'project-a')).toBeUndefined();
      expect(registry.getAll('project-a')).toEqual([builtin]);
    });
  });
});

describe('imageReference', () => {
  it('keeps the tag readable while pinning by digest', () => {
    // A stale digest then fails the pull outright, instead of silently
    // starting whatever the tag happens to point at today.
    expect(imageReference(tenantImage())).toBe(
      `ghcr.io/acme/etl:1.4.0@sha256:${'a'.repeat(64)}`
    );
  });

  it('accepts a digest that already carries the algorithm prefix', () => {
    expect(
      imageReference(tenantImage({ imageSha256: `sha256:${'b'.repeat(64)}` }))
    ).toBe(`ghcr.io/acme/etl:1.4.0@sha256:${'b'.repeat(64)}`);
  });

  it('falls back to the tag when no digest is recorded', () => {
    expect(imageReference(builtin)).toBe('holistixforge/ubuntu-terminal:24.04');
  });
});
