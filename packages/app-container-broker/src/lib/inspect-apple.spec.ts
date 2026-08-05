/**
 * Reading a container back out of Apple `container`.
 *
 * Docker answers a Go template and this answers JSON, so the adapter is small
 * — but everything downstream of it decides whether a start is really a
 * restart, which is a decision about removing something that is running. The
 * payload below is a real `container inspect` from `container` 1.2.0 on macOS
 * 26.5.2, trimmed to the fields the broker reads.
 */

import { inspectApple, appleContainerLabel } from './inspect-apple';

const INSPECTED = JSON.stringify([
  {
    configuration: {
      capAdd: ['CAP_CHOWN', 'CAP_NET_ADMIN'],
      capDrop: ['ALL'],
      id: 'holistix_etl_uc_abc12',
      image: {
        descriptor: { digest: `sha256:${'a'.repeat(64)}` },
        reference: `ghcr.io/acme/etl@sha256:${'a'.repeat(64)}`,
      },
      initProcess: {
        rlimits: [{ hard: 512, limit: 'RLIMIT_NPROC', soft: 512 }],
      },
      labels: {
        'holistix.project': 'project-1',
        'holistix.user_container': 'uc_abc12345',
      },
      resources: { cpus: 2, memoryInBytes: 2147483648 },
      runtimeHandler: 'container-runtime-linux',
    },
    id: 'holistix_etl_uc_abc12',
    status: { state: 'running' },
  },
]);

const answering = (out: string) => async () => out;

describe('inspectApple', () => {
  it('unwraps the single-element array the CLI always returns', async () => {
    const doc = await inspectApple(answering(INSPECTED), [
      'inspect',
      '--',
      'x',
    ]);

    expect((doc?.status as Record<string, unknown>)?.state).toBe('running');
  });

  it('answers undefined for something that is not there', async () => {
    // Every caller asks in order to act on absence, so this is never a throw.
    const exec = async () => {
      throw new Error('container not found: nosuchthing');
    };

    await expect(
      inspectApple(exec, ['inspect', '--', 'nosuchthing'])
    ).resolves.toBeUndefined();
  });

  it('answers undefined rather than raising on output it cannot parse', async () => {
    await expect(
      inspectApple(answering('not json at all'), ['inspect', '--', 'x'])
    ).resolves.toBeUndefined();
  });

  it('accepts a bare object as well as an array', async () => {
    const doc = await inspectApple(answering('{"id":"one"}'), ['inspect']);
    expect(doc?.id).toBe('one');
  });
});

describe('appleContainerLabel', () => {
  it('reads a label out of the configuration block', async () => {
    // Not `Config.Labels`: this engine puts a container's labels and a
    // network's in the same place, under `configuration`.
    await expect(
      appleContainerLabel(
        answering(INSPECTED),
        'holistix_etl_uc_abc12',
        'holistix.user_container'
      )
    ).resolves.toBe('uc_abc12345');
  });

  it('answers empty for a container that does not exist', async () => {
    // Which is what lets a start proceed when there is nothing in the way,
    // instead of failing on a lookup.
    const exec = async () => {
      throw new Error('container not found');
    };

    await expect(
      appleContainerLabel(exec, 'gone', 'holistix.user_container')
    ).resolves.toBe('');
  });

  it('answers empty for a container carrying no such label', async () => {
    // A name collision with something this broker did not start. The caller
    // then leaves it alone rather than removing it — "remove whatever is in
    // the way" is not a power this service holds.
    const foreign = JSON.stringify([{ configuration: { labels: {} } }]);

    await expect(
      appleContainerLabel(answering(foreign), 'x', 'holistix.user_container')
    ).resolves.toBe('');
  });
});
