import { TRuntimeExec } from './types';
import { UnsupportedByEngine } from './engine';

/**
 * Networks under Apple `container`.
 *
 * The same four verbs as the Docker side, and the same rule underneath: a
 * container starts on a private network of its own and reaches no sibling
 * until someone says otherwise. `container network create` takes `--label`,
 * so a network still carries the project it belongs to.
 *
 * Two differences, both measured on `container` 1.2.0:
 *
 *   `network list` has no `--filter`, so existence is decided by reading the
 *   names. There are few enough networks on a host for that to be the whole
 *   of it.
 *
 *   `network connect` does not exist. A container is attached to networks when
 *   it is started — `--network` is repeatable, verified with a container
 *   holding an address on two — and never afterwards. That is the
 *   `no-hot-network-attach` concession, and it is refused here rather than
 *   quietly doing nothing: on the whiteboard an edge between two services
 *   would then be drawn, saved, and mean nothing.
 */

const PROJECT_LABEL = 'holistix.project';

export const ensureAppleNetwork = async (
  exec: TRuntimeExec,
  name: string,
  projectId: string
): Promise<void> => {
  const listed = await exec(['network', 'list', '--quiet']).catch(() => '');
  if (listed.split('\n').some((line) => line.trim() === name)) return;

  await exec([
    'network',
    'create',
    '--label',
    `${PROJECT_LABEL}=${projectId}`,
    '--',
    name,
  ]);
};

export const attachToAppleNetwork = async (): Promise<never> => {
  throw new UnsupportedByEngine(
    'apple: a running container cannot be attached to a network — ' +
      '`container network connect` does not exist, so both services have to ' +
      'be started on the shared network'
  );
};

export const detachFromAppleNetwork = async (): Promise<never> => {
  throw new UnsupportedByEngine(
    'apple: a running container cannot be detached from a network'
  );
};

/**
 * Remove a shared network.
 *
 * `container network delete` refuses while containers are still attached,
 * which is the behaviour we want — but it says so on stderr and still exits 0,
 * so the refusal has to be read out of the message rather than the status.
 * Verified: deleting a network with two members answers
 * `cannot delete subnet … with referring containers`.
 */
export const removeAppleNetwork = async (
  exec: TRuntimeExec,
  name: string
): Promise<void> => {
  const out = await exec(['network', 'delete', '--', name]);
  if (/failed to delete network|^Error:|\nError:/.test(out)) {
    throw new Error(`could not remove network ${name}: ${out}`);
  }
};
