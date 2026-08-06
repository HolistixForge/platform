/**
 * What the Apple argv grants, and what it cannot say.
 *
 * The Docker translator has its own file and its own tests, and neither
 * changed. These assert the second vocabulary against the same requirements —
 * including, deliberately, the flags that are *absent*: a control that
 * disappeared from the argv without a concession behind it is exactly the
 * failure the concession list exists to catch.
 *
 * Every flag asserted here was accepted by `container` 1.2.0 on macOS 26.5.2
 * and read back out of `container inspect`.
 */

import { buildAppleRunArgs } from './run-args-apple';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';

const config: TBrokerConfig = {
  engine: 'apple',
  runtime: 'container-runtime-linux',
  acceptedConcessions: [],
  hostname: 'mac-host-1',
  token: 'broker-token',
  port: 9080,
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

const args = () => buildAppleRunArgs(request, image, config);

describe('what the container is isolated by', () => {
  it('drops every capability before adding any back', () => {
    const argv = args();
    const drop = argv.indexOf('--cap-drop=ALL');
    expect(drop).toBeGreaterThan(-1);
    expect(argv.findIndex((a) => a.startsWith('--cap-add='))).toBeGreaterThan(
      drop
    );
  });

  it('grants the baseline a conventional entrypoint needs', () => {
    // nginx, Jupyter, n8n and pgAdmin all chown a data directory and drop to a
    // non-root user. Without these they exit before doing anything.
    expect(args()).toEqual(
      expect.arrayContaining([
        '--cap-add=CHOWN',
        '--cap-add=SETUID',
        '--cap-add=SETGID',
      ])
    );
  });

  it('grants what the request asked for and validation allowed', () => {
    expect(args()).toContain('--cap-add=NET_ADMIN');
  });

  it('never passes a host device', () => {
    // Not policy here, unlike the Docker path: `container` has no --device at
    // all, and the guest kernel provides /dev/net/tun itself — verified inside
    // a container started with none.
    expect(args().join(' ')).not.toContain('--device');
  });

  it('takes the runtime handler from broker config, not the request', () => {
    expect(args()).toContain('--runtime=container-runtime-linux');
  });
});

describe('limits', () => {
  it('applies cpu and memory', () => {
    expect(args()).toEqual(
      expect.arrayContaining(['--cpus=2', '--memory=2048m'])
    );
  });

  it('caps processes with an nproc rlimit, both soft and hard', () => {
    // The `pids-cgroup` concession. RLIMIT_NPROC is enforced per uid at fork
    // by the guest kernel, not as a cgroup pids.max over the container — a cap
    // on a fork bomb, and not the same control.
    const argv = args();
    const at = argv.indexOf('--ulimit');
    expect(at).toBeGreaterThan(-1);
    expect(argv[at + 1]).toBe('nproc=512:512');
  });

  it('does not try to equalise swap', () => {
    // Not an omission: the guest boots with no swap at all (`free -m` reports
    // 0), so the memory limit is hard by construction rather than by making
    // --memory-swap match --memory.
    expect(args().join(' ')).not.toContain('--memory-swap');
  });
});

describe('the controls this engine cannot express', () => {
  // Each of these has a concession entry. The assertions are here so that a
  // later change cannot quietly start emitting a flag `container` will reject,
  // and so the absence stays deliberate rather than becoming folklore.
  it('sets no no-new-privileges', () => {
    expect(args().join(' ')).not.toContain('no-new-privileges');
  });

  it('sets no pids-limit', () => {
    expect(args().join(' ')).not.toContain('--pids-limit');
  });

  it('sets no restart policy', () => {
    expect(args().join(' ')).not.toContain('--restart');
  });

  it('sets no pull policy', () => {
    expect(args().join(' ')).not.toContain('--pull');
  });

  it('sets no extra hosts', () => {
    // The start is refused upstream when it carries any, rather than being run
    // without them.
    expect(args().join(' ')).not.toContain('--add-host');
  });
});

describe('identity and placement', () => {
  it('labels the container for reaping and for the project check', () => {
    expect(args()).toEqual(
      expect.arrayContaining([
        'holistix.organization=org-abc',
        'holistix.project=project-1',
        'holistix.user_container=uc_abc12345',
      ])
    );
  });

  it('puts the container on a private network of its own', () => {
    // The floor is isolation, not connectivity: a container reaches its
    // gateway and no sibling until someone attaches both to a shared network.
    expect(args()).toContain('--network=holistix_uc_uc_abc12345');
  });

  it('detaches, and carries the settings payload', () => {
    const argv = args();
    expect(argv[1]).toBe('--detach');
    const at = argv.indexOf('--env');
    expect(argv[at + 1]).toBe(`SETTINGS=${request.settings}`);
  });

  it('ends with the resolved reference, behind a --', () => {
    // So an image reference can never be read as a flag, whatever the
    // catalogue holds.
    const argv = args();
    expect(argv[argv.length - 2]).toBe('--');
    expect(argv[argv.length - 1]).toBe(image.reference);
  });

  it('never carries the registry credential', () => {
    expect(args().join(' ')).not.toContain('project-scoped-token');
  });
});
