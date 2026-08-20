jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Debug: 'debug',
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
  },
  log: jest.fn(),
}));

import { dockerEngine } from './engine-docker';
import { defaultReconcile, run, runOnce } from './loop';
import { TRunnerProject } from './projects';

const credentials = {
  ganymedeUrl: 'http://ganymede.test',
  runner_id: 'machine-1',
  label: 'laptop',
  token: 'a-runner-token',
};

const project = (id = 'project-1'): TRunnerProject => ({
  project_id: id,
  project_name: `Project ${id}`,
  organization_id: 'org-1',
  gateway_hostname: `gw-${id}.test`,
  token: `token-${id}`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Ganymede lists projects; each gateway accepts heartbeats. */
const platform = (projects: TRunnerProject[], gatewayStatus = 200) =>
  (async (input: string) =>
    String(input).includes('/runners/me/projects')
      ? json({ projects })
      : json({}, gatewayStatus)) as unknown as typeof fetch;

describe('runOnce', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should announce itself to every project it is in', async () => {
    // Act
    const result = await runOnce({
      credentials,
      fetchImpl: platform([project('a'), project('b')]),
    });

    // Assert
    expect(result).toEqual({
      projects: 2,
      heartbeats: { ok: 2, failed: 0 },
      revoked: false,
    });
  });

  it('should do nothing at all when it is in no project', async () => {
    // Arrange - freshly enrolled, nobody has placed anything on it
    const reconcileProject = jest.fn();

    // Act
    const result = await runOnce({
      credentials,
      fetchImpl: platform([]),
      reconcileProject,
    });

    // Assert - not an error, and nothing to reconcile
    expect(result.projects).toBe(0);
    expect(reconcileProject).not.toHaveBeenCalled();
  });

  it('should report revocation rather than throwing', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;

    // Act
    const result = await runOnce({ credentials, fetchImpl });

    // Assert - the loop stops on this; it is not a fault to retry
    expect(result.revoked).toBe(true);
  });

  it('should surface a platform outage as an error, not a revocation', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 503)) as unknown as typeof fetch;

    // Act / Assert - the difference decides between retrying and giving up
    await expect(runOnce({ credentials, fetchImpl })).rejects.toThrow();
  });

  it('should announce itself before reconciling', async () => {
    // Arrange
    const order: string[] = [];
    const fetchImpl = (async (input: string) => {
      const url = String(input);
      if (url.includes('/runners/me/projects'))
        return json({ projects: [project()] });
      order.push('heartbeat');
      return json({});
    }) as unknown as typeof fetch;

    // Act
    await runOnce({
      credentials,
      fetchImpl,
      reconcileProject: async () => {
        order.push('reconcile');
      },
    });

    // Assert - a machine that is up but slow to converge is still one the
    // project can see, and the catalog's threshold does not care why
    expect(order).toEqual(['heartbeat', 'reconcile']);
  });

  it('should keep reconciling the others when one project fails', async () => {
    // Arrange
    const done: string[] = [];

    // Act
    await runOnce({
      credentials,
      fetchImpl: platform([project('a'), project('b'), project('c')]),
      reconcileProject: async (p) => {
        if (p.project_id === 'b') throw new Error('docker is not running');
        done.push(p.project_id);
      },
    });

    // Assert - separate grants on separate gateways; one failing must not
    // darken the rest
    expect(done).toEqual(['a', 'c']);
  });

  it('should still report a pass when a gateway refuses the heartbeat', async () => {
    // Act
    const result = await runOnce({
      credentials,
      fetchImpl: platform([project('a'), project('b')], 502),
    });

    // Assert
    expect(result.heartbeats).toEqual({ ok: 0, failed: 2 });
    expect(result.revoked).toBe(false);
  });

  it('should identify itself by its own runner id, never by the project', async () => {
    // Arrange
    const bodies: string[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      if (String(input).includes('/runners/me/projects'))
        return json({ projects: [project()] });
      bodies.push(String(init?.body));
      return json({});
    }) as unknown as typeof fetch;

    // Act
    await runOnce({ credentials, fetchImpl });

    // Assert
    expect(JSON.parse(bodies[0]).event.machine_id).toBe('machine-1');
  });
});

describe('run', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should stop of its own accord once revoked', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;

    // Act / Assert - returns rather than spinning against a closed door
    await expect(
      run({ credentials, fetchImpl, intervalMs: 1 })
    ).resolves.toBeUndefined();
  });

  it('should keep going after a failed pass', async () => {
    // Arrange - the platform is unreachable, then comes back. A laptop lives
    // like this: a closed lid, a train, a hotel network.
    let calls = 0;
    const fetchImpl = (async (input: string) => {
      if (String(input).includes('/runners/me/projects')) {
        calls++;
        if (calls === 1) throw new Error('ENETDOWN');
        if (calls >= 3) return json({}, 403);
        return json({ projects: [] });
      }
      return json({});
    }) as unknown as typeof fetch;

    // Act
    await run({ credentials, fetchImpl, intervalMs: 1 });

    // Assert - it survived the first failure and reached the third pass
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  // The interval timer is the only thing referencing the event loop between
  // two passes: a pass opens no listener and holds no socket, and `process.once`
  // on a signal does not reference it. Unref'd — as it was — node finds nothing
  // left to do and exits cleanly, code 0, no message. Measured against a real
  // Ganymede: one pass, one `last_seen_at`, gone, on a runner that was meant to
  // announce itself every fifteen seconds.
  //
  // Asserted on the timer rather than on the number of passes, because a test
  // runner holds the loop open by itself and every pass-counting test here
  // passed throughout.
  it('should keep the process alive between passes', async () => {
    // Arrange
    const unrefs: unknown[] = [];
    const real = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number
    ) => {
      const timer = real(fn, ms);
      const originalUnref = timer.unref?.bind(timer);
      timer.unref = () => {
        unrefs.push(timer);
        return originalUnref ? originalUnref() : timer;
      };
      return timer;
    }) as unknown as typeof setTimeout);

    // Act - two passes, so at least one interval is waited out
    let calls = 0;
    const fetchImpl = (async (input: string) => {
      if (String(input).includes('/runners/me/projects')) {
        calls++;
        if (calls >= 2) return json({}, 403);
        return json({ projects: [] });
      }
      return json({});
    }) as unknown as typeof fetch;

    await run({ credentials, fetchImpl, intervalMs: 1 });
    spy.mockRestore();

    // Assert
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(unrefs).toHaveLength(0);
  });

  it('should stop when asked', async () => {
    // Arrange
    let stopNow = () => undefined as void;
    const stop = new Promise<void>((resolve) => (stopNow = resolve));

    // Act
    const loop = run({
      credentials,
      fetchImpl: platform([]),
      intervalMs: 10_000,
      stop,
    });
    stopNow();

    // Assert - and without waiting out the interval
    await expect(loop).resolves.toBeUndefined();
  });
});

//

describe('defaultReconcile', () => {
  const DIGEST =
    '@sha256:0000000000000000000000000000000000000000000000000000000000000000';

  const placement = (overrides: Record<string, unknown> = {}) => ({
    machine_id: 'machine-1',
    project_id: 'project-1',
    user_container_id: 'container-1',
    name: 'holistix_thing',
    imageRef: `ghcr.io/acme/thing:v1${DIGEST}`,
    settings: 'eyJ9',
    capabilities: [],
    devices: [],
    extraHosts: [],
    networks: [],
    ...overrides,
  });

  const dockerCalls = () => {
    const calls: string[][] = [];
    return { calls, exec: async (args: string[]) => (calls.push(args), '') };
  };

  const gatewayServing = (placements: unknown[]) =>
    (async (input: string) =>
      String(input).includes('/placements')
        ? json({ placements })
        : json({})) as unknown as typeof fetch;

  it('should start what the project placed on this machine', async () => {
    // Arrange
    const { calls, exec } = dockerCalls();

    // Act
    await defaultReconcile(
      credentials,
      dockerEngine,
      exec,
      gatewayServing([placement()])
    )(project());

    // Assert
    const run = calls.find((c) => c[0] === 'run');
    expect(run).toBeDefined();
    expect(run).toContain('holistix.machine=machine-1');
  });

  it('should refuse a placement addressed to another machine', async () => {
    // Arrange - the gateway filters by the machine in the token, and this
    // checks it anyway: two parties, neither the other's authority
    const { calls, exec } = dockerCalls();

    // Act
    await defaultReconcile(
      credentials,
      dockerEngine,
      exec,
      gatewayServing([placement({ machine_id: 'somebody-else' })])
    )(project());

    // Assert
    expect(calls.find((c) => c[0] === 'run')).toBeUndefined();
  });

  it('should refuse an image that is not digest-pinned', async () => {
    // Arrange - a bare tag means the platform-side resolution did not happen
    const { calls, exec } = dockerCalls();

    // Act
    await defaultReconcile(
      credentials,
      dockerEngine,
      exec,
      gatewayServing([placement({ imageRef: 'ghcr.io/acme/thing:v1' })])
    )(project());

    // Assert
    expect(calls.find((c) => c[0] === 'run')).toBeUndefined();
  });

  it('should keep going past one bad placement to the good ones', async () => {
    // Arrange
    const { calls, exec } = dockerCalls();

    // Act
    await defaultReconcile(
      credentials,
      dockerEngine,
      exec,
      gatewayServing([
        placement({ machine_id: 'somebody-else' }),
        placement({ user_container_id: 'container-2', name: 'good' }),
      ])
    )(project());

    // Assert - one misaddressed row must not stop the rest converging
    const run = calls.find((c) => c[0] === 'run');
    expect(run).toContain('holistix.user_container_id=container-2');
  });

  it('should refuse a placement for a project this pass is not about', async () => {
    // Arrange - the token names one project; a row naming another has no
    // business being acted on under it
    const { calls, exec } = dockerCalls();

    // Act
    await defaultReconcile(
      credentials,
      dockerEngine,
      exec,
      gatewayServing([placement({ project_id: 'project-2' })])
    )(project());

    // Assert
    expect(calls.find((c) => c[0] === 'run')).toBeUndefined();
  });
});
