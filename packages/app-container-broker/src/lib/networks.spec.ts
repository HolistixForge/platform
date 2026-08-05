/**
 * Network tests.
 *
 * Networks are deliberately independent of images: an image entry never names a
 * network, a network references running containers, and a container can be
 * attached long after it started. These tests pin that independence, and the
 * one check that keeps a network from bridging two tenants.
 */

import {
  privateNetworkName,
  sharedNetworkName,
  ensureNetwork,
  attachToNetwork,
  detachFromNetwork,
  NetworkError,
} from './networks';

/** Records argv, and answers `docker inspect` from a label map. */
const runtime = (labels: Record<string, string> = {}, existing = '') => {
  const calls: string[][] = [];
  const exec = async (args: string[]) => {
    calls.push(args);
    if (args[0] === 'network' && args[1] === 'ls') return existing;
    if (args[1] === 'inspect') return labels[args[args.length - 1]] ?? '';
    return 'ok';
  };
  return { calls, exec };
};

describe('network names', () => {
  it('gives each container a private network of its own', () => {
    expect(privateNetworkName('uc_abc12345')).toBe('holistix_uc_uc_abc12345');
  });

  it('scopes a shared network to its project', () => {
    expect(sharedNetworkName('project-1', 'data')).toBe(
      'holistix_net_project-1_data'
    );
  });

  it.each([
    ['--internal', 'a name that would parse as a flag'],
    ['has spaces', 'a name with separators'],
    ['a;rm -rf /', 'shell metacharacters'],
    ['', 'an empty name'],
  ])('refuses %s (%s)', (name) => {
    expect(() => sharedNetworkName('project-1', name)).toThrow(NetworkError);
  });
});

describe('ensureNetwork', () => {
  it('creates the network when it is absent', async () => {
    const { calls, exec } = runtime();

    await ensureNetwork(exec, 'holistix_net_project-1_data', 'project-1');

    const create = calls.find((c) => c[1] === 'create');
    expect(create).toContain('--label');
    expect(create).toContain('holistix.project=project-1');
    expect(create?.[create.length - 1]).toBe('holistix_net_project-1_data');
  });

  it('does nothing when it already exists', async () => {
    // Attaching a service to a network someone else already created is the
    // normal case, not an error.
    const { calls, exec } = runtime({}, 'holistix_net_project-1_data\n');

    await ensureNetwork(exec, 'holistix_net_project-1_data', 'project-1');

    expect(calls.filter((c) => c[1] === 'create')).toHaveLength(0);
  });
});

describe('attachToNetwork', () => {
  it('attaches a container of the same project', async () => {
    // The point of the feature: two services wired together after both are
    // already running, with no reference to either image.
    const { calls, exec } = runtime({
      'holistix_net_project-1_data': 'project-1',
      abc123: 'project-1',
    });

    await attachToNetwork(exec, 'holistix_net_project-1_data', 'abc123');

    const connect = calls.find((c) => c[1] === 'connect');
    expect(connect).toEqual([
      'network',
      'connect',
      '--',
      'holistix_net_project-1_data',
      'abc123',
    ]);
  });

  it('refuses to bridge two projects', async () => {
    // This single check is what stops a network from becoming a way across the
    // tenant boundary.
    const { calls, exec } = runtime({
      'holistix_net_project-1_data': 'project-1',
      abc123: 'project-2',
    });

    await expect(
      attachToNetwork(exec, 'holistix_net_project-1_data', 'abc123')
    ).rejects.toThrow('belongs to project project-2');

    expect(calls.filter((c) => c[1] === 'connect')).toHaveLength(0);
  });

  it('refuses when either side carries no project label', async () => {
    // An unlabelled container is one this broker did not start. Attaching it
    // would mean trusting a label that is not there.
    const { exec } = runtime({ 'holistix_net_project-1_data': 'project-1' });

    await expect(
      attachToNetwork(exec, 'holistix_net_project-1_data', 'stranger')
    ).rejects.toThrow('carries no project label');
  });

  it('reads both projects from the runtime, not from the caller', async () => {
    const { calls, exec } = runtime({
      'holistix_net_project-1_data': 'project-1',
      abc123: 'project-1',
    });

    await attachToNetwork(exec, 'holistix_net_project-1_data', 'abc123');

    const inspects = calls.filter((c) => c[1] === 'inspect');
    expect(inspects).toHaveLength(2);
    expect(inspects.map((c) => c[0]).sort()).toEqual(['container', 'network']);
  });
});

describe('detachFromNetwork', () => {
  it('disconnects without consulting labels', async () => {
    // Removing access needs no permission check: taking connectivity away is
    // never the dangerous direction.
    const { calls, exec } = runtime();

    await detachFromNetwork(exec, 'holistix_net_project-1_data', 'abc123');

    expect(calls[0]).toEqual([
      'network',
      'disconnect',
      '--',
      'holistix_net_project-1_data',
      'abc123',
    ]);
  });
});
