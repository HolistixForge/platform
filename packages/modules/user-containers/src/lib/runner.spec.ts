/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runner command generation tests
 *
 * The settings blob built here is the only channel the auth guard secret takes
 * to the container, and the container record it is built from lives in collab
 * shared state. These tests pin which of the two the secret comes from.
 */

import { ContainerRunner, TRunnerConfig } from './runner';
import { ContainerImageRegistry } from './image-registry';
import { TUserContainer } from './servers-types';

class TestRunner extends ContainerRunner {
  async start(): Promise<any> {
    return {};
  }
}

const imageRegistry = () => {
  const registry = new ContainerImageRegistry();
  registry.register([
    {
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      imageUri: 'holistixforge/ubuntu-terminal',
      imageTag: '24.04',
      description: 'Minimal Ubuntu container',
      category: 'utility',
    },
  ]);
  return registry;
};

const container = (authGuard?: { client_id: string }): TUserContainer =>
  ({
    user_container_id: 'uc_abc12345',
    container_name: 'My Terminal',
    image_id: 'ubuntu:terminal',
    runner: { id: 'local' },
    auth_guard: authGuard,
    httpServices: [],
    last_watchdog_at: null,
    last_activity: null,
    created_at: '2026-01-01T00:00:00.000Z',
  } as TUserContainer);

const config = (overrides: Partial<TRunnerConfig> = {}): TRunnerConfig => ({
  user_id: 'user-1',
  project_id: 'project-1',
  frontend_fqdn: 'domain.local',
  ganymede_fqdn: 'ganymede.domain.local',
  gateway_fqdn: 'org-abc123.domain.local',
  organization_id: 'abc123',
  ...overrides,
});

/** Pull the base64 SETTINGS payload back out of the docker run command. */
const settingsFrom = (command: string) => {
  const encoded = /-e SETTINGS=(\S+)/.exec(command)?.[1];
  if (!encoded) throw new Error(`no SETTINGS in command: ${command}`);
  return JSON.parse(Buffer.from(encoded, 'base64').toString());
};

describe('ContainerRunner.generateCommand', () => {
  const runner = new TestRunner();

  const generate = (c: TUserContainer, cfg: TRunnerConfig) =>
    runner.generateCommand(c, 'jwt-token', imageRegistry(), cfg);

  it('takes the auth guard secret from the config, not the container', () => {
    const command = generate(
      container({ client_id: 'client-1' }),
      config({ auth_guard_client_secret: 'from-gateway-memory' })
    );

    expect(settingsFrom(command).auth_guard).toEqual({
      client_id: 'client-1',
      client_secret: 'from-gateway-memory',
      container_id: 'uc_abc12345',
      organization_id: 'abc123',
    });
  });

  it('omits auth guard config when no secret is available', () => {
    // A gateway that cannot resolve the secret must not hand the container a
    // half-built guard config it would fail OAuth with.
    const command = generate(container({ client_id: 'client-1' }), config());

    expect(settingsFrom(command).auth_guard).toBeUndefined();
  });

  it('omits auth guard config for a container without a client', () => {
    const command = generate(
      container(undefined),
      config({ auth_guard_client_secret: 'orphan-secret' })
    );

    expect(settingsFrom(command).auth_guard).toBeUndefined();
  });

  it('ignores a secret smuggled onto the container record', () => {
    // Shared state is replicated to every client, so a collaborator could write
    // a client_secret onto the container. It must never reach the container.
    const tampered = {
      ...container({ client_id: 'client-1' }),
      auth_guard: { client_id: 'client-1', client_secret: 'injected' },
    } as unknown as TUserContainer;

    const command = generate(
      tampered,
      config({ auth_guard_client_secret: 'from-gateway-memory' })
    );

    expect(settingsFrom(command).auth_guard.client_secret).toBe(
      'from-gateway-memory'
    );
    expect(command).not.toContain('injected');
  });

  it('still carries the hosting token and identity settings', () => {
    const settings = settingsFrom(
      generate(container({ client_id: 'client-1' }), config())
    );

    expect(settings).toMatchObject({
      user_id: 'user-1',
      project_id: 'project-1',
      token: 'jwt-token',
      user_container_id: 'uc_abc12345',
    });
  });
});

/**
 * The hosts entries handed to whatever starts the container.
 *
 * They exist because a container has to reach its gateway by FQDN before it
 * has a tunnel, and in development that name is not in any DNS. They are
 * *hostnames*, which is the whole point: the FQDNs they are built from carry a
 * port wherever nginx does not listen on 443, and the broker refuses the entire
 * start with "extra_hosts entry has a malformed host" — correctly.
 */
describe('ContainerRunner.buildLaunchSpec — extra hosts', () => {
  const runner = new TestRunner();

  const spec = (cfg: Partial<TRunnerConfig>) =>
    runner.buildLaunchSpec(
      container({ client_id: 'client-1' }),
      'jwt-token',
      imageRegistry(),
      config({ dev_host_ip: '172.17.0.1', ...cfg })
    );

  it('should drop the port when the FQDNs carry one', () => {
    const built = spec({
      ganymede_fqdn: 'ganymede.apollo.test:8443',
      gateway_fqdn: 'org-abc123.apollo.test:8443',
    });

    expect(built.extraHosts).toEqual([
      { host: 'org-abc123.apollo.test', ip: '172.17.0.1' },
      { host: 'ganymede.apollo.test', ip: '172.17.0.1' },
    ]);
    for (const entry of built.extraHosts) {
      expect(entry.host).not.toContain(':');
    }
  });

  it('should leave a portless FQDN exactly as it is', () => {
    const built = spec({});

    expect(built.extraHosts).toEqual([
      { host: 'org-abc123.domain.local', ip: '172.17.0.1' },
      { host: 'ganymede.domain.local', ip: '172.17.0.1' },
    ]);
  });

  it('should send none at all when no dev host address is configured', () => {
    // Production resolves these names for real; inventing entries there would
    // send a container somewhere else for a reason invisible from outside.
    expect(spec({ dev_host_ip: undefined }).extraHosts).toEqual([]);
  });
});

//

/**
 * Which reference a runner is handed.
 *
 * The distinction is not cosmetic: a digest makes the runtime resolve the
 * manifest at the registry even when the tag is on disk, and a runner holds no
 * registry credentials. Measured on Apple `container` — with the digest, `401
 * Unauthorized, no credentials found for host registry-1.docker.io`; with the
 * tag alone, the same image started from disk in five seconds.
 */
describe('ContainerRunner.buildLaunchSpec — image reference', () => {
  class Spec extends ContainerRunner {
    async start() {
      return {};
    }
  }

  const build = (registry: ContainerImageRegistry, imageId: string) =>
    new Spec().buildLaunchSpec(
      { ...container(), image_id: imageId } as TUserContainer,
      'jwt-token',
      registry,
      config()
    );

  it('references a built-in by tag, never by digest', () => {
    // Arrange - a built-in that happens to carry a digest, as jupyter's do
    const registry = new ContainerImageRegistry();
    registry.register([
      {
        imageId: 'jupyter:minimal',
        imageName: 'JupyterLab',
        imageUri: 'holistixforge/jupyterlab-minimal',
        imageTag: 'lab-4.2.0',
        imageSha256: 'a'.repeat(64),
      },
    ]);

    // Act / Assert - trusted by being in this deployment's catalogue, not by
    // the digest, and the digest is what costs the start
    expect(build(registry, 'jupyter:minimal').imageRef).toBe(
      'holistixforge/jupyterlab-minimal:lab-4.2.0'
    );
  });

  it('keeps the digest on a tenant image', () => {
    // Arrange
    const registry = new ContainerImageRegistry();
    registry.registerForProject('project-1', 'acme', [
      {
        imageId: 'acme:etl',
        imageName: 'Acme ETL',
        imageUri: 'ghcr.io/acme/etl',
        imageTag: '1.4.0',
        imageSha256: 'b'.repeat(64),
      },
    ]);

    // Act / Assert - a tenant image is trusted *because* it is pinned, and the
    // runner refuses one that is not
    expect(build(registry, 'acme:etl').imageRef).toBe(
      `ghcr.io/acme/etl:1.4.0@sha256:${'b'.repeat(64)}`
    );
  });
});
