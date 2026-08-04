/**
 * Argv construction tests.
 *
 * What ends up on this command line is the container's actual privilege. The
 * tests below pin the parts that a request must not be able to influence.
 */

import { buildRunArgs } from './run-args';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';

const config: TBrokerConfig = {
  runtime: 'kata',
  hostname: 'platform-host-1',
  token: 'broker-token',
  port: 9443,
  maxLimits: { cpus: 4, memoryMb: 8192, pidsLimit: 2048 },
};

const image: TResolvedImage = {
  imageId: 'ubuntu:terminal',
  reference: `holistixforge/ubuntu-terminal:24.04@sha256:${'c'.repeat(64)}`,
};

const request = (overrides: Partial<TStartRequest> = {}): TStartRequest => ({
  organization_id: 'org-abc',
  project_id: 'project-1',
  user_container_id: 'uc_abc12345',
  name: 'holistix_terminal_uc_abc12',
  image_id: 'ubuntu:terminal',
  settings: 'eyJ1c2VyX2lkIjoidTEifQ==',
  capabilities: ['NET_ADMIN'],
  devices: [],
  extra_hosts: [{ host: 'ganymede.domain.local', ip: '172.17.0.1' }],
  limits: { cpus: 2, memoryMb: 2048, pidsLimit: 512 },
  ...overrides,
});

/** Find the value of a `--flag=value` argument. */
const flagValue = (args: string[], flag: string): string | undefined =>
  args
    .find((a) => a.startsWith(`${flag}=`))
    ?.split('=')
    .slice(1)
    .join('=');

describe('buildRunArgs', () => {
  it('pins the runtime from broker configuration', () => {
    // A container that fell back to runc would share the host kernel with every
    // other tenant — the one outcome this path exists to prevent.
    const args = buildRunArgs(request(), image, config);

    expect(flagValue(args, '--runtime')).toBe('kata');
  });

  it('cannot have its runtime overridden by the request', () => {
    const args = buildRunArgs(
      request({ image_id: '--runtime=runc' } as Partial<TStartRequest>),
      image,
      config
    );

    expect(args.filter((a) => a.startsWith('--runtime='))).toEqual([
      '--runtime=kata',
    ]);
  });

  it('drops all capabilities before adding the allowed one back', () => {
    const args = buildRunArgs(request(), image, config);
    const dropIndex = args.indexOf('--cap-drop=ALL');
    const addIndex = args.indexOf('--cap-add=NET_ADMIN');

    expect(dropIndex).toBeGreaterThanOrEqual(0);
    expect(addIndex).toBeGreaterThan(dropIndex);
  });

  it('forbids acquiring new privileges', () => {
    // Without this a container could regain what --cap-drop took away.
    expect(buildRunArgs(request(), image, config)).toContain(
      '--security-opt=no-new-privileges'
    );
  });

  it('applies every resource limit', () => {
    const args = buildRunArgs(request(), image, config);

    expect(flagValue(args, '--cpus')).toBe('2');
    expect(flagValue(args, '--memory')).toBe('2048m');
    expect(flagValue(args, '--pids-limit')).toBe('512');
  });

  it('caps swap at the memory limit', () => {
    // Otherwise memory pressure spills into swap and the limit means nothing.
    const args = buildRunArgs(request(), image, config);

    expect(flagValue(args, '--memory-swap')).toBe(flagValue(args, '--memory'));
  });

  it('uses the resolved reference, never the requested id', () => {
    const args = buildRunArgs(
      request({ image_id: 'something-else' }),
      image,
      config
    );

    expect(args[args.length - 1]).toBe(image.reference);
    expect(args).not.toContain('something-else');
  });

  it('terminates flag parsing before the image reference', () => {
    const args = buildRunArgs(request(), image, config);

    expect(args[args.length - 2]).toBe('--');
  });

  it('labels the container with its owners so it can be reaped', () => {
    const args = buildRunArgs(request(), image, config);

    expect(args).toContain('holistix.organization=org-abc');
    expect(args).toContain('holistix.project=project-1');
    expect(args).toContain('holistix.user_container=uc_abc12345');
  });

  it('passes the settings blob as an environment variable', () => {
    const args = buildRunArgs(request(), image, config);
    const envIndex = args.indexOf('--env');

    expect(args[envIndex + 1]).toBe('SETTINGS=eyJ1c2VyX2lkIjoidTEifQ==');
  });

  it('passes no host devices whatever the request held', () => {
    const args = buildRunArgs(
      request({ devices: ['/dev/net/tun'] }),
      image,
      config
    );

    expect(args).not.toContain('--device');
    expect(args.join(' ')).not.toContain('/dev/net/tun');
  });

  it('builds an argv array, never a shell string', () => {
    // execFile spawns without a shell, so this is what keeps a value that
    // happens to contain a semicolon a value rather than a command.
    const args = buildRunArgs(request(), image, config);

    expect(Array.isArray(args)).toBe(true);
    expect(args.every((a) => typeof a === 'string')).toBe(true);
  });
});
