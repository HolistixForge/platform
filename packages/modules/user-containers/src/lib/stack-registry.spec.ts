/**
 * Stack catalogue tests.
 *
 * A stack is where "only some services are reachable" has to hold. The routing
 * for it already exists — a container publishes one `map-http-service` per door
 * and the gateway writes one nginx block per entry — so what these tests pin is
 * the catalogue's half: that a stack cannot name an image its project could not
 * have started alone, that two doors cannot describe one FQDN, and that a
 * service says nothing when it is not exposed.
 */

import { ContainerImageRegistry } from './image-registry';
import { ContainerStackRegistry } from './stack-registry';
import { TContainerImageDefinition } from './container-image';
import {
  TContainerStackDefinition,
  stackExposedPorts,
} from './container-stack';

const builtinImage: TContainerImageDefinition = {
  imageId: 'ubuntu:terminal',
  imageName: 'Ubuntu Terminal',
  imageUri: 'holistixforge/ubuntu-terminal',
  imageTag: '24.04',
};

const tenantImage: TContainerImageDefinition = {
  imageId: 'acme:api',
  imageName: 'Acme API',
  imageUri: 'ghcr.io/acme/api',
  imageTag: '1.4.0',
  imageSha256: 'a'.repeat(64),
};

const tenantDb: TContainerImageDefinition = {
  imageId: 'acme:db',
  imageName: 'Acme DB',
  imageUri: 'ghcr.io/acme/db',
  imageTag: '16',
  imageSha256: 'b'.repeat(64),
};

/** The shape this whole slice exists for: an interface out, a database not. */
const stack = (
  overrides: Partial<TContainerStackDefinition> = {}
): TContainerStackDefinition => ({
  stackId: 'acme:platform',
  stackName: 'Acme Platform',
  services: [
    {
      serviceName: 'api',
      imageId: 'acme:api',
      exposes: [{ name: 'main', port: 8080, secure: true }],
    },
    { serviceName: 'db', imageId: 'acme:db' },
  ],
  ...overrides,
});

describe('ContainerStackRegistry', () => {
  let images: ContainerImageRegistry;
  let stacks: ContainerStackRegistry;

  beforeEach(() => {
    images = new ContainerImageRegistry();
    images.register([builtinImage]);
    images.registerForProject('p1', 'acme', [tenantImage, tenantDb]);
    stacks = new ContainerStackRegistry(images);
  });

  describe('choosing what is exposed', () => {
    it('keeps a service with no exposes off the routing table', () => {
      stacks.registerForProject('p1', [stack()]);

      const doors = stackExposedPorts(
        stacks.get('acme:platform', 'p1') as TContainerStackDefinition
      );

      expect(doors).toEqual([
        {
          serviceName: 'api',
          expose: { name: 'main', port: 8080, secure: true },
        },
      ]);
    });

    it('lets one stack expose several doors', () => {
      stacks.registerForProject('p1', [
        stack({
          services: [
            {
              serviceName: 'api',
              imageId: 'acme:api',
              exposes: [
                { name: 'main', port: 8080 },
                { name: 'metrics', port: 9090 },
              ],
            },
            { serviceName: 'db', imageId: 'acme:db' },
          ],
        }),
      ]);

      expect(
        stackExposedPorts(
          stacks.get('acme:platform', 'p1') as TContainerStackDefinition
        ).map((d) => d.expose.name)
      ).toEqual(['main', 'metrics']);
    });

    it('refuses two services claiming the same door', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              {
                serviceName: 'api',
                imageId: 'acme:api',
                exposes: [{ name: 'app', port: 8080 }],
              },
              {
                serviceName: 'db',
                imageId: 'acme:db',
                exposes: [{ name: 'app', port: 5432 }],
              },
            ],
          }),
        ])
      ).toThrow(/exposes app on both api and db/);
    });

    // `generateServiceFQDN` sends both to the base FQDN, so this is one route
    // described twice rather than two routes.
    it('treats main and default as the same door', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              {
                serviceName: 'api',
                imageId: 'acme:api',
                exposes: [{ name: 'main', port: 8080 }],
              },
              {
                serviceName: 'db',
                imageId: 'acme:db',
                exposes: [{ name: 'default', port: 5432 }],
              },
            ],
          }),
        ])
      ).toThrow(/main and default are the same name/);
    });
  });

  describe('the allowlist, carried sideways', () => {
    it('refuses an image the project has not registered', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [{ serviceName: 'api', imageId: 'someone:else' }],
          }),
        ])
      ).toThrow(/image someone:else is not in this project's catalogue/);
    });

    it("refuses another project's image", () => {
      images.registerForProject('p2', 'other', [
        {
          imageId: 'other:api',
          imageName: 'Other API',
          imageUri: 'ghcr.io/other/api',
          imageTag: '1.0.0',
          imageSha256: 'c'.repeat(64),
        },
      ]);

      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [{ serviceName: 'api', imageId: 'other:api' }],
          }),
        ])
      ).toThrow(/not in this project's catalogue/);
    });

    it('allows a built-in image inside a project stack', () => {
      stacks.registerForProject('p1', [
        stack({
          services: [{ serviceName: 'shell', imageId: 'ubuntu:terminal' }],
        }),
      ]);

      expect(stacks.get('acme:platform', 'p1')).toBeDefined();
    });

    // A built-in stack has no project, so it can only see built-in images —
    // otherwise one id would mean a different stack per project.
    it('refuses a project image inside a built-in stack', () => {
      expect(() =>
        stacks.register([
          stack({
            stackId: 'builtin:thing',
            services: [{ serviceName: 'api', imageId: 'acme:api' }],
          }),
        ])
      ).toThrow(/not in this project's catalogue/);
    });
  });

  describe('ids', () => {
    it('refuses a stack id that is already an image id', () => {
      expect(() =>
        stacks.registerForProject('p1', [stack({ stackId: 'acme:api' })])
      ).toThrow(/collides with an image of the same id/);
    });

    it('refuses taking over a built-in stack', () => {
      stacks.register([
        stack({
          stackId: 'builtin:shell',
          services: [{ serviceName: 'shell', imageId: 'ubuntu:terminal' }],
        }),
      ]);

      expect(() =>
        stacks.registerForProject('p1', [stack({ stackId: 'builtin:shell' })])
      ).toThrow(/cannot be overridden/);
    });

    it('refuses the same stack twice in one project', () => {
      stacks.registerForProject('p1', [stack()]);
      expect(() => stacks.registerForProject('p1', [stack()])).toThrow(
        /already registered for project p1/
      );
    });

    it('requires a projectId', () => {
      expect(() => stacks.registerForProject('', [stack()])).toThrow(
        /projectId is required/
      );
    });
  });

  describe('names that become routes', () => {
    it('refuses a service name that is not a DNS label', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [{ serviceName: 'My_API', imageId: 'acme:api' }],
          }),
        ])
      ).toThrow(/service name must be a lowercase DNS label/);
    });

    // The FQDN is built by interpolation and nothing strips dots, so this
    // would add a label and answer somewhere nobody asked for.
    it('refuses a dot in an exposed name', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              {
                serviceName: 'api',
                imageId: 'acme:api',
                exposes: [{ name: 'a.b', port: 8080 }],
              },
            ],
          }),
        ])
      ).toThrow(/must be a lowercase DNS label/);
    });

    it('refuses the reserved __ prefix', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              {
                serviceName: 'api',
                imageId: 'acme:api',
                exposes: [{ name: '__guard_base', port: 8443 }],
              },
            ],
          }),
        ])
      ).toThrow(/reserved __ prefix/);
    });

    it.each([0, 65536, 1.5])('refuses port %p', (port) => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              {
                serviceName: 'api',
                imageId: 'acme:api',
                exposes: [{ name: 'main', port }],
              },
            ],
          }),
        ])
      ).toThrow(/is not a port number/);
    });

    it('refuses a stack with no services', () => {
      expect(() =>
        stacks.registerForProject('p1', [stack({ services: [] })])
      ).toThrow(/has no services/);
    });

    it('refuses a service name declared twice', () => {
      expect(() =>
        stacks.registerForProject('p1', [
          stack({
            services: [
              { serviceName: 'api', imageId: 'acme:api' },
              { serviceName: 'api', imageId: 'acme:db' },
            ],
          }),
        ])
      ).toThrow(/declares service api twice/);
    });
  });

  describe('tenant isolation', () => {
    it('does not show a stack to another project', () => {
      stacks.registerForProject('p1', [stack()]);
      expect(stacks.get('acme:platform', 'p2')).toBeUndefined();
      expect(stacks.getAll('p2')).toEqual([]);
    });

    it('shows built-in stacks to every project', () => {
      stacks.register([
        stack({
          stackId: 'builtin:shell',
          services: [{ serviceName: 'shell', imageId: 'ubuntu:terminal' }],
        }),
      ]);

      expect(stacks.get('builtin:shell', 'p2')).toBeDefined();
      expect(stacks.isBuiltin('builtin:shell')).toBe(true);
    });

    it('drops a project catalogue on clear', () => {
      stacks.registerForProject('p1', [stack()]);
      stacks.clearProject('p1');
      expect(stacks.get('acme:platform', 'p1')).toBeUndefined();
    });

    // The pairing, by construction rather than by the caller remembering:
    // clearing the images a tenant supplied clears the stacks naming them.
    it('goes with the images when the image catalogue is cleared', () => {
      stacks.registerForProject('p1', [stack()]);
      images.clearProject('p1');
      expect(stacks.get('acme:platform', 'p1')).toBeUndefined();
    });

    it('leaves other projects alone when one is cleared', () => {
      images.registerForProject('p2', 'acme', [tenantImage, tenantDb]);
      stacks.registerForProject('p1', [stack()]);
      stacks.registerForProject('p2', [stack()]);

      images.clearProject('p1');

      expect(stacks.get('acme:platform', 'p1')).toBeUndefined();
      expect(stacks.get('acme:platform', 'p2')).toBeDefined();
    });

    it('resolves nothing but built-ins without a project', () => {
      stacks.registerForProject('p1', [stack()]);
      expect(stacks.get('acme:platform')).toBeUndefined();
    });
  });
});
