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
