/**
 * Networks under Apple `container`.
 *
 * Same floor as the Docker side — a container starts alone on a network of its
 * own — reached through a smaller vocabulary. The interesting cases are the
 * two places the CLI behaves differently: no `--filter` on the list, and a
 * delete that refuses on stderr while still exiting 0.
 */

import {
  ensureAppleNetwork,
  attachToAppleNetwork,
  detachFromAppleNetwork,
  removeAppleNetwork,
} from './networks-apple';
import { UnsupportedByEngine } from './engine';

const recorder = (behaviour: (args: string[]) => string = () => '') => {
  const calls: string[][] = [];
  const exec = async (args: string[]) => {
    calls.push(args);
    return behaviour(args);
  };
  return { calls, exec };
};

describe('ensureAppleNetwork', () => {
  it('creates the network with the project it belongs to', async () => {
    const { calls, exec } = recorder();

    await ensureAppleNetwork(exec, 'holistix_uc_uc_abc12345', 'project-1');

    expect(calls).toContainEqual([
      'network',
      'create',
      '--label',
      'holistix.project=project-1',
      '--',
      'holistix_uc_uc_abc12345',
    ]);
  });

  it('does not create one that is already there', async () => {
    // `network list` has no --filter here, so existence is decided by reading
    // the names back.
    const { calls, exec } = recorder((args) =>
      args[1] === 'list' ? 'default\nholistix_uc_uc_abc12345\n' : ''
    );

    await ensureAppleNetwork(exec, 'holistix_uc_uc_abc12345', 'project-1');

    expect(calls.some((c) => c[1] === 'create')).toBe(false);
  });

  it('does not mistake a name that merely contains the one asked for', async () => {
    // Without a filter this is a substring trap: `holistix_uc_uc_abc1` would
    // otherwise be answered by `holistix_uc_uc_abc12345` already existing, and
    // the run would then reference a network nobody created.
    const { calls, exec } = recorder((args) =>
      args[1] === 'list' ? 'holistix_uc_uc_abc12345\n' : ''
    );

    await ensureAppleNetwork(exec, 'holistix_uc_uc_abc1', 'project-1');

    expect(calls.some((c) => c[1] === 'create')).toBe(true);
  });

  it('creates the network when the list cannot be read', async () => {
    const calls: string[][] = [];
    const exec = async (args: string[]) => {
      calls.push(args);
      if (args[1] === 'list') throw new Error('daemon not running');
      return '';
    };

    await ensureAppleNetwork(exec, 'holistix_uc_uc_abc12345', 'project-1');

    expect(calls.some((c) => c[1] === 'create')).toBe(true);
  });
});

describe('wiring two running services together', () => {
  it('is refused rather than silently doing nothing', async () => {
    // `container network connect` does not exist. A no-op would let someone
    // draw an edge between two services on the whiteboard, save it, and have
    // it mean nothing — which is worse than being told it cannot be done.
    await expect(attachToAppleNetwork()).rejects.toThrow(UnsupportedByEngine);
    await expect(attachToAppleNetwork()).rejects.toThrow(
      /started on the shared network/
    );
  });

  it('refuses to detach for the same reason', async () => {
    await expect(detachFromAppleNetwork()).rejects.toThrow(UnsupportedByEngine);
  });
});

describe('removeAppleNetwork', () => {
  it('removes a network nothing is attached to', async () => {
    const { calls, exec } = recorder(() => 'holistix_net_project-1_link');

    await removeAppleNetwork(exec, 'holistix_net_project-1_link');

    expect(calls[0]).toEqual([
      'network',
      'delete',
      '--',
      'holistix_net_project-1_link',
    ]);
  });

  it('raises when the network is still in use', async () => {
    // Pulling a network out from under a running service would break it
    // silently. `container` refuses — but says so on stderr and still exits 0,
    // so the refusal has to be read out of the message.
    const { exec } = recorder(
      () =>
        'failed to delete network: ["error": invalidState: "cannot delete ' +
        'subnet link with referring containers: a, b"]'
    );

    await expect(
      removeAppleNetwork(exec, 'holistix_net_project-1_link')
    ).rejects.toThrow(/could not remove network/);
  });
});
