/**
 * Image catalogue tests.
 *
 * Once organizations can supply images, `image_id` stops being a label and
 * becomes an allowlist key — a runner is handed an id and resolves it here.
 * These tests pin the three properties that key depends on: tenants cannot see
 * each other's images, cannot take over a built-in id, and cannot register an
 * image that is not pinned to an exact artifact.
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

const orgImage = (
  overrides: Partial<TContainerImageDefinition> = {}
): TContainerImageDefinition => ({
  imageId: 'acme:etl',
  imageName: 'Acme ETL',
  imageUri: 'registry.acme.example/etl',
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
    it('resolves for any organization', () => {
      expect(registry.get('ubuntu:terminal', 'org-a')).toEqual(builtin);
      expect(registry.get('ubuntu:terminal', 'org-b')).toEqual(builtin);
      expect(registry.get('ubuntu:terminal')).toEqual(builtin);
    });

    it('rejects a duplicate registration', () => {
      expect(() => registry.register([builtin])).toThrow('already registered');
    });
  });

  describe('organization images', () => {
    it('resolves only for the organization that registered it', () => {
      registry.registerForOrganization('org-a', [orgImage()]);

      expect(registry.get('acme:etl', 'org-a')).toMatchObject({
        imageId: 'acme:etl',
      });
      expect(registry.get('acme:etl', 'org-b')).toBeUndefined();
    });

    it('is invisible without an organization', () => {
      // getAll() with no organization is what a caller that forgot to scope
      // would reach for. It must degrade to the built-in catalogue, never to
      // "everything anyone registered".
      registry.registerForOrganization('org-a', [orgImage()]);

      expect(registry.get('acme:etl')).toBeUndefined();
      expect(registry.getAll()).toEqual([builtin]);
    });

    it('does not leak one tenant catalogue into another', () => {
      registry.registerForOrganization('org-a', [orgImage()]);
      registry.registerForOrganization('org-b', [
        orgImage({ imageId: 'globex:sim' }),
      ]);

      expect(registry.getAll('org-a').map((i) => i.imageId)).toEqual([
        'ubuntu:terminal',
        'acme:etl',
      ]);
      expect(registry.getAll('org-b').map((i) => i.imageId)).toEqual([
        'ubuntu:terminal',
        'globex:sim',
      ]);
    });

    it('refuses to shadow a built-in id', () => {
      // Otherwise a user picking "Ubuntu Terminal" from the catalogue would
      // silently start whatever the organization registered under that id.
      expect(() =>
        registry.registerForOrganization('org-a', [
          orgImage({ imageId: 'ubuntu:terminal' }),
        ])
      ).toThrow('cannot be overridden');

      expect(registry.get('ubuntu:terminal', 'org-a')).toEqual(builtin);
    });

    it('refuses an image that is not pinned by digest', () => {
      expect(() =>
        registry.registerForOrganization('org-a', [
          orgImage({ imageSha256: undefined }),
        ])
      ).toThrow('must be pinned by digest');
    });

    it('refuses a duplicate id within the same organization', () => {
      registry.registerForOrganization('org-a', [orgImage()]);
      expect(() =>
        registry.registerForOrganization('org-a', [orgImage()])
      ).toThrow('already registered for organization');
    });

    it('requires an organization id', () => {
      expect(() => registry.registerForOrganization('', [orgImage()])).toThrow(
        'organizationId is required'
      );
    });

    it('drops a catalogue on clearOrganization', () => {
      // Gateway pool containers are reallocated between organizations; one that
      // keeps serving the previous tenant's catalogue is a leak, not staleness.
      registry.registerForOrganization('org-a', [orgImage()]);
      registry.clearOrganization('org-a');

      expect(registry.get('acme:etl', 'org-a')).toBeUndefined();
      expect(registry.getAll('org-a')).toEqual([builtin]);
    });
  });
});

describe('imageReference', () => {
  it('keeps the tag readable while pinning by digest', () => {
    // A stale digest then fails the pull outright, instead of silently
    // starting whatever the tag happens to point at today.
    expect(imageReference(orgImage())).toBe(
      `registry.acme.example/etl:1.4.0@sha256:${'a'.repeat(64)}`
    );
  });

  it('accepts a digest that already carries the algorithm prefix', () => {
    expect(
      imageReference(orgImage({ imageSha256: `sha256:${'b'.repeat(64)}` }))
    ).toBe(`registry.acme.example/etl:1.4.0@sha256:${'b'.repeat(64)}`);
  });

  it('falls back to the tag when no digest is recorded', () => {
    expect(imageReference(builtin)).toBe('holistixforge/ubuntu-terminal:24.04');
  });
});
