/**
 * Stack manifest tests.
 *
 * The manifest's own job is small and specific: say what a service opens, say
 * which of those get a name, and refuse the gap between the two. Everything
 * catalogue-shaped belongs to `ContainerStackRegistry`, so the last block here
 * checks the two compose rather than re-checking its rules.
 */

import { STACK_MANIFEST_VERSION, parseStackManifest } from './stack-manifest';
import { ContainerImageRegistry } from './image-registry';
import { ContainerStackRegistry } from './stack-registry';

const manifest = (overrides: Record<string, unknown> = {}) => ({
  version: STACK_MANIFEST_VERSION,
  stack: 'acme:platform',
  name: 'Acme Platform',
  services: {
    api: {
      image: 'acme:api',
      ports: [8080],
      tunnel: [{ port: 8080, name: 'main' }],
    },
    db: { image: 'acme:db', ports: [5432] },
  },
  ...overrides,
});

describe('parseStackManifest', () => {
  describe('ports and tunnel are different questions', () => {
    it('leaves a service with ports and no tunnel unexposed', () => {
      const stack = parseStackManifest(manifest());

      expect(stack.services).toEqual([
        {
          serviceName: 'api',
          imageId: 'acme:api',
          exposes: [{ name: 'main', port: 8080 }],
        },
        { serviceName: 'db', imageId: 'acme:db' },
      ]);
    });

    // The mistake the split exists to catch: a name and an nginx block onto a
    // port nothing listens on, which looks like a broken tunnel.
    it('refuses tunnelling a port the service does not open', () => {
      expect(() =>
        parseStackManifest(
          manifest({
            services: {
              api: {
                image: 'acme:api',
                ports: [8080],
                tunnel: [{ port: 9090, name: 'metrics' }],
              },
            },
          })
        )
      ).toThrow(/tunnel port 9090 is not in ports \[8080\]/);
    });

    it('tunnels several ports of one service', () => {
      const stack = parseStackManifest(
        manifest({
          services: {
            api: {
              image: 'acme:api',
              ports: [8080, 9090],
              tunnel: [
                { port: 8080, name: 'main' },
                { port: 9090, name: 'metrics', secure: false },
              ],
            },
          },
        })
      );

      expect(stack.services[0].exposes).toEqual([
        { name: 'main', port: 8080 },
        { name: 'metrics', port: 9090, secure: false },
      ]);
    });

    it('names a door after its service when the manifest does not', () => {
      const stack = parseStackManifest(
        manifest({
          services: {
            api: { image: 'acme:api', ports: [8080], tunnel: [{ port: 8080 }] },
          },
        })
      );

      expect(stack.services[0].exposes).toEqual([{ name: 'api', port: 8080 }]);
    });
  });

  describe('shape', () => {
    it('refuses an unknown version', () => {
      expect(() => parseStackManifest(manifest({ version: 2 }))).toThrow(
        /version must be 1, got 2/
      );
    });

    it('refuses a missing version', () => {
      expect(() =>
        parseStackManifest(manifest({ version: undefined }))
      ).toThrow(/version must be 1/);
    });

    it('refuses a manifest that is not a mapping', () => {
      expect(() => parseStackManifest('nope')).toThrow(/must be a mapping/);
    });

    it('refuses a stack with no name', () => {
      expect(() => parseStackManifest(manifest({ stack: '' }))).toThrow(
        /must name a stack/
      );
    });

    it('refuses no services', () => {
      expect(() => parseStackManifest(manifest({ services: {} }))).toThrow(
        /has no services/
      );
    });

    it('refuses a service with no image', () => {
      expect(() =>
        parseStackManifest(manifest({ services: { api: { ports: [80] } } }))
      ).toThrow(/service api: image is required/);
    });

    it('refuses a port that is not a port', () => {
      expect(() =>
        parseStackManifest(
          manifest({ services: { api: { image: 'acme:api', ports: [0] } } })
        )
      ).toThrow(/port 0 is not a port number/);
    });

    it('refuses a tunnel that is not a list', () => {
      expect(() =>
        parseStackManifest(
          manifest({
            services: { api: { image: 'acme:api', ports: [80], tunnel: 80 } },
          })
        )
      ).toThrow(/tunnel must be a list/);
    });

    it('names the stack in the error', () => {
      expect(() =>
        parseStackManifest(manifest({ services: { api: { ports: [80] } } }))
      ).toThrow(/^Stack acme:platform: /);
    });

    it('falls back to the id when there is no display name', () => {
      expect(parseStackManifest(manifest({ name: undefined })).stackName).toBe(
        'acme:platform'
      );
    });
  });

  describe('live sync', () => {
    const withSync = (sync: unknown) =>
      manifest({
        services: { api: { image: 'acme:api', ports: [8080], sync } },
      });

    it('reads a directory to keep in step', () => {
      expect(
        parseStackManifest(withSync([{ from: './api', to: '/app' }]))
          .services[0].sync
      ).toEqual([{ from: 'api', to: '/app' }]);
    });

    it('leaves sync off a service that asked for none', () => {
      expect(parseStackManifest(manifest()).services[0].sync).toBeUndefined();
    });

    // The manifest is a file from a repository, run by a script somebody
    // pasted into their terminal. These are the two ways it reaches out of the
    // checkout and onto the machine.
    it.each(['../secrets', 'api/../../.ssh', 'a/../..'])(
      'refuses %p climbing out of the repository',
      (from) => {
        expect(() =>
          parseStackManifest(withSync([{ from, to: '/app' }]))
        ).toThrow(/must stay inside the repository/);
      }
    );

    it.each(['/etc', '\\\\server\\share', 'C:\\Users'])(
      'refuses the absolute path %p',
      (from) => {
        expect(() =>
          parseStackManifest(withSync([{ from, to: '/app' }]))
        ).toThrow(/must be relative to the manifest/);
      }
    );

    it('refuses a container path that is not absolute', () => {
      expect(() =>
        parseStackManifest(withSync([{ from: 'api', to: 'app' }]))
      ).toThrow(/sync to must be an absolute path/);
    });

    it('refuses sync that is not a list', () => {
      expect(() => parseStackManifest(withSync('api:/app'))).toThrow(
        /sync must be a list/
      );
    });
  });

  describe('with the catalogue behind it', () => {
    let stacks: ContainerStackRegistry;

    beforeEach(() => {
      const images = new ContainerImageRegistry();
      images.registerForProject('p1', 'acme', [
        {
          imageId: 'acme:api',
          imageName: 'Acme API',
          imageUri: 'ghcr.io/acme/api',
          imageTag: '1.0.0',
          imageSha256: 'a'.repeat(64),
        },
        {
          imageId: 'acme:db',
          imageName: 'Acme DB',
          imageUri: 'ghcr.io/acme/db',
          imageTag: '16',
          imageSha256: 'b'.repeat(64),
        },
      ]);
      stacks = new ContainerStackRegistry(images);
    });

    it('registers a manifest the project can start', () => {
      stacks.registerForProject('p1', [parseStackManifest(manifest())]);
      expect(stacks.get('acme:platform', 'p1')?.services).toHaveLength(2);
    });

    // The manifest cannot see the catalogue, so this is the registry's rule
    // firing on a manifest that parsed perfectly well.
    it('still refuses an image outside the project catalogue', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          parseStackManifest(
            manifest({
              services: { api: { image: 'someone:else', ports: [80] } },
            })
          ),
        ])
      ).toThrow(/not in this project's catalogue/);
    });

    // Defaulting a door to its service name means two services cannot
    // accidentally collide — but two explicit names still can, and that is
    // caught downstream rather than here.
    it('still refuses two doors describing one FQDN', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          parseStackManifest(
            manifest({
              services: {
                api: {
                  image: 'acme:api',
                  ports: [8080],
                  tunnel: [{ port: 8080, name: 'app' }],
                },
                db: {
                  image: 'acme:db',
                  ports: [5432],
                  tunnel: [{ port: 5432, name: 'app' }],
                },
              },
            })
          ),
        ])
      ).toThrow(/exposes app on both api and db/);
    });
  });
});
