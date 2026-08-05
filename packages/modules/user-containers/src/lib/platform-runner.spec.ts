/**
 * Platform runner tests.
 *
 * The gateway is the tenant-facing process. What it is able to ask the broker
 * for is therefore a security boundary, not an interface detail — these tests
 * pin that it can name a catalogue entry and nothing more.
 */

import {
  PlatformRunnerBackend,
  TBrokerStartRequest,
  TBrokerStartResponse,
} from './platform-runner';
import { ContainerImageRegistry } from './image-registry';
import { TRunnerConfig, DEFAULT_CONTAINER_LIMITS } from './runner';
import { TUserContainer } from './servers-types';

const imageRegistry = () => {
  const registry = new ContainerImageRegistry();
  registry.register([
    {
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      imageUri: 'holistixforge/ubuntu-terminal',
      imageTag: '24.04',
      imageSha256: 'c'.repeat(64),
      category: 'utility',
    },
  ]);
  return registry;
};

const container = (): TUserContainer =>
  ({
    user_container_id: 'uc_abc12345',
    container_name: 'My Terminal',
    image_id: 'ubuntu:terminal',
    runner: { id: 'platform' },
    auth_guard: { client_id: 'client-1' },
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
  auth_guard_client_secret: 'from-gateway-memory',
  ...overrides,
});

const response: TBrokerStartResponse = {
  container_id: 'kata-9f3',
  host: 'platform-host-1',
  runtime: 'kata',
};

/** Run a start and hand back what the broker was asked for. */
const startAndCapture = async (
  runner?: PlatformRunnerBackend
): Promise<{ request: TBrokerStartRequest; result: any }> => {
  let captured: TBrokerStartRequest | undefined;
  const subject =
    runner ??
    new PlatformRunnerBackend({
      transport: async (r) => {
        captured = r;
        return response;
      },
    });

  const result = await subject.start(
    container(),
    'jwt-token',
    imageRegistry(),
    config()
  );

  if (!captured) throw new Error('transport was never called');
  return { request: captured, result };
};

describe('PlatformRunnerBackend', () => {
  it('asks the broker for a catalogue id, never an image URI', async () => {
    // The broker re-resolves the id host-side. If the gateway could name a URI
    // instead, a compromised gateway could run any image on the platform.
    const { request } = await startAndCapture();

    expect(request.image_id).toBe('ubuntu:terminal');
    expect(JSON.stringify(request)).not.toContain('holistixforge/');
    expect(JSON.stringify(request)).not.toContain('docker run');
  });

  it('passes no host devices', async () => {
    // The local runner passes /dev/net/tun. Under a microVM the guest has its
    // own kernel, so the host device node is at best meaningless and at worst
    // a hole through the isolation the microVM exists to provide.
    const { request } = await startAndCapture();

    expect(request.devices).toEqual([]);
    expect(request.capabilities).toEqual(['NET_ADMIN']);
  });

  it('carries the settings blob and scopes the request', async () => {
    const { request } = await startAndCapture();

    const settings = JSON.parse(
      Buffer.from(request.settings, 'base64').toString()
    );
    expect(settings).toMatchObject({
      user_id: 'user-1',
      project_id: 'project-1',
      token: 'jwt-token',
      user_container_id: 'uc_abc12345',
    });
    expect(request.organization_id).toBe('abc123');
    expect(request.user_container_id).toBe('uc_abc12345');
  });

  it('always sends resource limits', async () => {
    // Nothing capped CPU or memory while containers ran on the user's own
    // machine. On shared infrastructure an uncapped start is not acceptable,
    // and a microVM needs a memory figure at boot regardless.
    const { request } = await startAndCapture();

    expect(request.limits).toEqual(DEFAULT_CONTAINER_LIMITS);
  });

  it('honours configured limits', async () => {
    const limits = { cpus: 8, memoryMb: 16384, pidsLimit: 4096 };
    let captured: TBrokerStartRequest | undefined;
    const runner = new PlatformRunnerBackend({
      limits,
      transport: async (r) => {
        captured = r;
        return response;
      },
    });

    await runner.start(container(), 'jwt', imageRegistry(), config());

    expect(captured?.limits).toEqual(limits);
  });

  it('records where the container landed', async () => {
    const { result } = await startAndCapture();

    expect(result).toMatchObject({
      broker_container_id: 'kata-9f3',
      host: 'platform-host-1',
      runtime: 'kata',
    });
  });

  it('records what isolated it, so the card can say', async () => {
    // The platform ships two engines with different guarantees. A deployment
    // that isolates less while the UI says nothing is the silent failure the
    // broker's "no default runtime" rule exists to prevent — one level up,
    // where the cost is a user believing they got a private kernel.
    const runner = new PlatformRunnerBackend({
      transport: async () => ({
        ...response,
        engine: 'apple',
        isolation: 'microvm' as const,
        concessions: ['no-new-privileges', 'pids-cgroup'],
      }),
    });

    const result = await runner.start(
      container(),
      'jwt',
      imageRegistry(),
      config()
    );

    expect(result).toMatchObject({
      engine: 'apple',
      isolation: 'microvm',
      concessions: ['no-new-privileges', 'pids-cgroup'],
    });
  });

  it('carries a shared kernel through rather than dropping it', async () => {
    // The one verdict worth interrupting someone for, so it must survive the
    // hop that a happy-path-only forward would lose.
    const runner = new PlatformRunnerBackend({
      transport: async () => ({
        ...response,
        engine: 'docker',
        runtime: 'runc',
        isolation: 'shared-kernel' as const,
        concessions: [],
      }),
    });

    const result = await runner.start(
      container(),
      'jwt',
      imageRegistry(),
      config()
    );

    expect(result).toMatchObject({
      runtime: 'runc',
      isolation: 'shared-kernel',
    });
  });

  it('says nothing rather than assuming safe when the broker was silent', async () => {
    // An older broker sends host and runtime and no verdict. Defaulting to
    // 'microvm' would invent an answer, and the safe-looking default is the
    // one that costs something when it is wrong — so the field is absent and
    // the card shows it as unknown.
    const { result } = await startAndCapture();

    expect(result).not.toHaveProperty('isolation');
    expect(result).not.toHaveProperty('engine');
    expect(result).not.toHaveProperty('concessions');
  });

  it('refuses an image this project cannot see', async () => {
    // Registered against another project, so it must not resolve here — the
    // pull credential is project-scoped, and the catalogue follows it.
    const registry = imageRegistry();
    registry.registerForProject('someone-elses-project', 'acme', [
      {
        imageId: 'acme:etl',
        imageName: 'Acme ETL',
        imageUri: 'ghcr.io/acme/etl',
        imageTag: '1.4.0',
        imageSha256: 'd'.repeat(64),
      },
    ]);
    const runner = new PlatformRunnerBackend({
      transport: async () => response,
    });
    const foreign = { ...container(), image_id: 'acme:etl' } as TUserContainer;

    await expect(
      runner.start(foreign, 'jwt', registry, config())
    ).rejects.toThrow('not found in registry');
  });

  it('resolves an image registered for this project', async () => {
    const registry = imageRegistry();
    registry.registerForProject('project-1', 'acme', [
      {
        imageId: 'acme:etl',
        imageName: 'Acme ETL',
        imageUri: 'ghcr.io/acme/etl',
        imageTag: '1.4.0',
        imageSha256: 'd'.repeat(64),
      },
    ]);
    let captured: TBrokerStartRequest | undefined;
    const runner = new PlatformRunnerBackend({
      transport: async (r) => {
        captured = r;
        return response;
      },
    });
    const own = { ...container(), image_id: 'acme:etl' } as TUserContainer;

    await runner.start(own, 'jwt', registry, config());

    expect(captured?.image_id).toBe('acme:etl');
  });

  it('fails loudly when no broker is configured', async () => {
    const runner = new PlatformRunnerBackend();

    await expect(
      runner.start(container(), 'jwt', imageRegistry(), config())
    ).rejects.toThrow('not configured');
  });

  it('never falls back to the ambient environment', async () => {
    // Module packages are bundled with a browser `process` shim, so
    // `process.env` is an empty object at runtime in the gateway. A fallback
    // to it would not merely fail — it would read as "not configured" and the
    // platform runner would silently never register, which is what happened
    // the first time this was deployed.
    process.env.CONTAINER_BROKER_URL = 'http://should-not-be-used:9443';
    process.env.CONTAINER_BROKER_TOKEN = 'should-not-be-used';

    try {
      const runner = new PlatformRunnerBackend();
      await expect(
        runner.start(container(), 'jwt', imageRegistry(), config())
      ).rejects.toThrow('not configured');
    } finally {
      delete process.env.CONTAINER_BROKER_URL;
      delete process.env.CONTAINER_BROKER_TOKEN;
    }
  });
});
