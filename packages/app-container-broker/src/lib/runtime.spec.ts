/**
 * Start sequencing tests.
 *
 * The layer cache is shared by the whole host while a pull credential belongs
 * to one project. What keeps those two facts from combining into an access
 * hole is the order and independence of the two commands below.
 */

import { startContainer } from './runtime';
import { dockerEngine } from './engine-docker';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';

const config: TBrokerConfig = {
  engine: 'docker',
  runtime: 'kata',
  acceptedConcessions: [],
  hostname: 'platform-host-1',
  token: 'broker-token',
  port: 9443,
  maxLimits: { cpus: 4, memoryMb: 8192, pidsLimit: 2048 },
};

const image: TResolvedImage = {
  imageId: 'acme:etl',
  reference: `ghcr.io/acme/etl:1.4.0@sha256:${'a'.repeat(64)}`,
  pullToken: 'project-scoped-token',
};

const request: TStartRequest = {
  organization_id: 'org-abc',
  project_id: 'project-1',
  user_container_id: 'uc_abc12345',
  name: 'holistix_etl_uc_abc12',
  image_id: 'acme:etl',
  settings: 'eyJ1c2VyX2lkIjoidTEifQ==',
  capabilities: ['NET_ADMIN'],
  devices: [],
  extra_hosts: [],
  limits: { cpus: 2, memoryMb: 2048, pidsLimit: 512 },
};

const recorder = () => {
  const calls: string[][] = [];
  return {
    calls,
    exec: async (args: string[]) => {
      calls.push(args);
      return 'kata-9f3';
    },
  };
};

/** The single `run` argv from a recorded sequence. */
const runCall = (calls: string[][]) => calls.find((c) => c[0] === 'run');

describe('restarting an existing container', () => {
  /** Answers a label for `container inspect`, records everything else. */
  const withExisting = (label: string) => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      if (args[1] === 'inspect') return label;
      return 'kata-9f3';
    };
    return { calls, exec };
  };

  it('removes its own container so the start can proceed', async () => {
    // Starting a service that already runs is how someone restarts it. Docker
    // answers Conflict on the name, which says nothing to the person who
    // clicked.
    const { calls, exec } = withExisting('uc_abc12345');

    await startContainer(dockerEngine, exec, request, image, config);

    const rm = calls.find((c) => c[0] === 'rm');
    expect(rm).toEqual(['rm', '--force', '--', request.name]);
    expect(calls.findIndex((c) => c[0] === 'rm')).toBeLessThan(
      calls.findIndex((c) => c[0] === 'run')
    );
  });

  it('leaves a name collision it does not own alone', async () => {
    // This runs as root on the platform host. "Remove whatever is in the way"
    // is not a power it should hold — the run is allowed to fail instead.
    const { calls, exec } = withExisting('someone-elses-container');

    await startContainer(dockerEngine, exec, request, image, config);

    expect(calls.some((c) => c[0] === 'rm')).toBe(false);
  });

  it('does nothing when there is no container to replace', async () => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      if (args[1] === 'inspect') throw new Error('No such container');
      return 'kata-9f3';
    };

    await startContainer(dockerEngine, exec, request, image, config);

    expect(calls.some((c) => c[0] === 'rm')).toBe(false);
    expect(calls.some((c) => c[0] === 'run')).toBe(true);
  });
});

describe('startContainer', () => {
  it('pulls, prepares the network, then runs — in that order', async () => {
    // The container's own network has to exist before the run references it,
    // and the image has to be local before the run is told never to pull.
    const { calls, exec } = recorder();

    await startContainer(dockerEngine, exec, request, image, config);

    // A credentialed pull leads with --config, so match on content rather than
    // on the first argument.
    const at = (p: (c: string[]) => boolean) => calls.findIndex(p);
    const pull = at((c) => c.includes('pull'));
    const network = at((c) => c[0] === 'network');
    const run = at((c) => c[0] === 'run');

    expect(pull).toBeGreaterThanOrEqual(0);
    expect(network).toBeGreaterThan(pull);
    expect(run).toBeGreaterThan(network);
  });

  it('puts the container on its own network, never the default bridge', async () => {
    // On the default bridge every container on the host reaches every other by
    // IP, including another tenant's.
    const { calls, exec } = recorder();

    await startContainer(dockerEngine, exec, request, image, config);

    expect(runCall(calls)).toContain('--network=holistix_uc_uc_abc12345');
  });

  it('re-authenticates on every start, cached or not', async () => {
    // The pull is not skipped when the image is already on the host. That is
    // deliberate: the layer cache is shared, so once one project has pulled a
    // private image, another naming the same digest would otherwise get it
    // without ever proving it has access. The layers are local and cheap; the
    // manifest fetch still goes to the registry, and that is what checks the
    // token.
    const { calls, exec } = recorder();

    await startContainer(dockerEngine, exec, request, image, config);
    await startContainer(dockerEngine, exec, request, image, config);

    expect(calls.filter((c) => c.includes('pull'))).toHaveLength(2);
  });

  it('never lets the run do its own pull', async () => {
    // A run that fetched on its own would do it with the host's ambient
    // credentials rather than this project's.
    const { calls, exec } = recorder();

    await startContainer(dockerEngine, exec, request, image, config);

    expect(runCall(calls)).toContain('--pull=never');
  });

  it('keeps the registry credential out of the run', async () => {
    const { calls, exec } = recorder();

    await startContainer(dockerEngine, exec, request, image, config);

    expect(runCall(calls)?.join(' ')).not.toContain('project-scoped-token');
    expect(runCall(calls)).not.toContain('--config');
  });

  it('does not run when the pull fails', async () => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      if (args.includes('pull')) throw new Error('unauthorized');
      return 'kata-9f3';
    };

    await expect(
      startContainer(dockerEngine, exec, request, image, config)
    ).rejects.toThrow('unauthorized');

    expect(calls.filter((c) => c[0] === 'run')).toHaveLength(0);
  });

  it('returns the container id the runtime reported', async () => {
    const { exec } = recorder();

    await expect(
      startContainer(dockerEngine, exec, request, image, config)
    ).resolves.toBe('kata-9f3');
  });
});
