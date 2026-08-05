jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Debug: 'debug',
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
  },
  log: jest.fn(),
}));

import { run, runOnce } from './loop';
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
