import { TRuntimeExec } from './runtime';

export class NetworkError extends Error {}

/**
 * Networks, kept deliberately independent of images.
 *
 * An image entry never names a network and a network never names an image. A
 * network references *running containers*, and containers can be attached and
 * detached after the fact — which is what lets someone wire two services
 * together long after both were started, or wire a service that does not exist
 * yet by attaching it later.
 *
 * The floor is isolation, not connectivity. Every container starts on a private
 * network of its own: it can reach the outside (its gateway over VPN, a package
 * registry) and it can reach no sibling. Two services talk only because someone
 * said they should.
 *
 * That floor also closes a hole that has nothing to do with the feature.
 * Without `--network`, Docker puts every container on the default bridge, where
 * every container on the host can reach every other by IP — including another
 * tenant's. Kata does not help: it isolates the kernel, not the L2 segment.
 */

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$/;

const assertSafe = (label: string, value: string): string => {
  if (!SAFE_SEGMENT.test(value)) {
    throw new NetworkError(`${label} is missing or malformed`);
  }
  return value;
};

/** The private network a single container lives on. */
export const privateNetworkName = (userContainerId: string): string =>
  `holistix_uc_${assertSafe('user_container_id', userContainerId)}`;

/** A network someone created to link services together. */
export const sharedNetworkName = (projectId: string, name: string): string =>
  `holistix_net_${assertSafe('project_id', projectId)}_${assertSafe(
    'network name',
    name
  )}`;

const PROJECT_LABEL = 'holistix.project';

/**
 * Create a network if it is not already there.
 *
 * `--internal` is deliberately absent: a container needs to reach its gateway
 * over VPN, and an internal network has no route out.
 */
export const ensureNetwork = async (
  exec: TRuntimeExec,
  name: string,
  projectId: string
): Promise<void> => {
  const existing = await exec([
    'network',
    'ls',
    '--filter',
    `name=^${name}$`,
    '--format',
    '{{.Name}}',
  ]);
  if (existing.trim() === name) return;

  await exec([
    'network',
    'create',
    '--label',
    `${PROJECT_LABEL}=${projectId}`,
    '--',
    name,
  ]);
};

/**
 * Which project a network or container belongs to, read from its label.
 *
 * Read from the runtime rather than taken from the request: this is the value
 * the cross-project check below depends on, so a caller must not be able to
 * assert it.
 */
const projectOf = async (
  exec: TRuntimeExec,
  kind: 'network' | 'container',
  id: string
): Promise<string> => {
  const out = await exec([
    kind === 'network' ? 'network' : 'container',
    'inspect',
    '--format',
    `{{index .${
      kind === 'network' ? 'Labels' : 'Config.Labels'
    } "${PROJECT_LABEL}"}}`,
    '--',
    id,
  ]);
  return out.trim();
};

/**
 * Attach a container to a shared network.
 *
 * Refuses to cross projects. Both sides are read back from the runtime rather
 * than trusted from the request, because this single check is what stops a
 * network from becoming a way to bridge two tenants.
 */
export const attachToNetwork = async (
  exec: TRuntimeExec,
  networkName: string,
  containerId: string
): Promise<void> => {
  const [networkProject, containerProject] = await Promise.all([
    projectOf(exec, 'network', networkName),
    projectOf(exec, 'container', containerId),
  ]);

  if (!networkProject || !containerProject) {
    throw new NetworkError(
      'network or container carries no project label; refusing to attach'
    );
  }
  if (networkProject !== containerProject) {
    throw new NetworkError(
      `container belongs to project ${containerProject}, network to ${networkProject}`
    );
  }

  await exec(['network', 'connect', '--', networkName, containerId]);
};

export const detachFromNetwork = async (
  exec: TRuntimeExec,
  networkName: string,
  containerId: string
): Promise<void> => {
  await exec(['network', 'disconnect', '--', networkName, containerId]);
};

/**
 * Remove a shared network.
 *
 * Docker refuses while containers are still attached, which is the behaviour we
 * want: removing a network out from under a running service would break it
 * silently.
 */
export const removeNetwork = async (
  exec: TRuntimeExec,
  networkName: string
): Promise<void> => {
  await exec(['network', 'rm', '--', networkName]);
};
