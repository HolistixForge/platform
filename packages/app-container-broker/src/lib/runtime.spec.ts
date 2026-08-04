/**
 * Start sequencing tests.
 *
 * The layer cache is shared by the whole host while a pull credential belongs
 * to one project. What keeps those two facts from combining into an access
 * hole is the order and independence of the two commands below.
 */

import { startContainer } from './runtime';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';

const config: TBrokerConfig = {
  runtime: 'kata',
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

describe('startContainer', () => {
  it('pulls first, then runs', async () => {
    const { calls, exec } = recorder();

    await startContainer(exec, request, image, config);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('pull');
    expect(calls[1][0]).toBe('run');
  });

  it('re-authenticates on every start, cached or not', async () => {
    // The pull is not skipped when the image is already on the host. That is
    // deliberate: the layer cache is shared, so once one project has pulled a
    // private image, another naming the same digest would otherwise get it
    // without ever proving it has access. The layers are local and cheap; the
    // manifest fetch still goes to the registry, and that is what checks the
    // token.
    const { calls, exec } = recorder();

    await startContainer(exec, request, image, config);
    await startContainer(exec, request, image, config);

    expect(calls.filter((c) => c.includes('pull'))).toHaveLength(2);
  });

  it('never lets the run do its own pull', async () => {
    // A run that fetched on its own would do it with the host's ambient
    // credentials rather than this project's.
    const { calls, exec } = recorder();

    await startContainer(exec, request, image, config);

    expect(calls[1]).toContain('--pull=never');
  });

  it('keeps the registry credential out of the run', async () => {
    const { calls, exec } = recorder();

    await startContainer(exec, request, image, config);

    expect(calls[1].join(' ')).not.toContain('project-scoped-token');
    expect(calls[1]).not.toContain('--config');
  });

  it('does not run when the pull fails', async () => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      if (args.includes('pull')) throw new Error('unauthorized');
      return 'kata-9f3';
    };

    await expect(startContainer(exec, request, image, config)).rejects.toThrow(
      'unauthorized'
    );

    expect(calls.filter((c) => c[0] === 'run')).toHaveLength(0);
  });

  it('returns the container id the runtime reported', async () => {
    const { exec } = recorder();

    await expect(startContainer(exec, request, image, config)).resolves.toBe(
      'kata-9f3'
    );
  });
});
