import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * The docker CLI, as a set of calls rather than a string.
 *
 * execFile and never a shell: every value here — a container name, an image
 * reference, a network — arrives from the platform, and a shell would turn a
 * name containing a semicolon into a command on this machine. There is no
 * quoting to get right if nothing is ever parsed.
 */

export type TDockerExec = (args: string[]) => Promise<string>;

export const dockerExec =
  (binary = 'docker'): TDockerExec =>
  async (args: string[]) => {
    const { stdout } = await run(binary, args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  };

/** Labels every container this runner starts, so it can find them again. */
export const LABEL_PROJECT = 'holistix.project';
export const LABEL_CONTAINER = 'holistix.user_container_id';
export const LABEL_MACHINE = 'holistix.machine';

/**
 * What the broker calls the same thing.
 *
 * Two writers, two spellings, one container: the broker labels
 * `holistix.user_container`, this runner `holistix.user_container_id`. Both set
 * `holistix.project`, so `listOwned` *did* return the broker's container — with
 * no id on it. `planReconcile` drops anything it cannot name, concluded there
 * was no container for the placement, and asked to create one whose name was
 * already taken.
 *
 * Measured moving a notebook from the platform to a laptop: `container with id
 * holistix_notebook_uc_msiod already exists`, every ten seconds, for ever.
 *
 * Read, never written. Unifying the two would be the tidier answer and it is
 * not this one: the broker's spelling is on every container it has already
 * started, and a runner that only understood the new one would go on being
 * unable to adopt them. Recognising both costs one `??`.
 */
export const LABEL_CONTAINER_BROKER = 'holistix.user_container';

/** The container id under whichever of the two spellings is present. */
export const containerIdFromLabels = (
  labels: Record<string, string> | undefined
): string | undefined =>
  labels?.[LABEL_CONTAINER] ?? labels?.[LABEL_CONTAINER_BROKER];

export type TRunningContainer = {
  /** Docker's id. */
  id: string;
  name: string;
  /** The image reference it was actually started from. */
  image: string;
  /** `running`, `exited`, `created`… */
  state: string;
  project_id?: string;
  user_container_id?: string;
  networks: string[];
};

type TInspectOutput = {
  Id: string;
  Name: string;
  State: { Status: string };
  Config: { Image: string; Labels?: Record<string, string> };
  NetworkSettings: { Networks?: Record<string, unknown> };
};

/**
 * Every container this runner owns for a project, running or not.
 *
 * `--all` on purpose: a container that exited is not a container that is
 * missing, and treating it as missing is how reconciliation turns into a loop
 * that recreates the same broken thing every pass.
 */
export const listOwned = async (
  exec: TDockerExec,
  project_id: string
): Promise<TRunningContainer[]> => {
  const ids = (
    await exec([
      'ps',
      '--all',
      '--filter',
      `label=${LABEL_PROJECT}=${project_id}`,
      '--format',
      '{{.ID}}',
    ])
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!ids.length) return [];

  return inspect(exec, ids);
};

export const inspect = async (
  exec: TDockerExec,
  ids: string[]
): Promise<TRunningContainer[]> => {
  const raw = await exec(['inspect', ...ids]);
  const parsed = JSON.parse(raw) as TInspectOutput[];

  return parsed.map((c) => ({
    id: c.Id,
    // Docker returns the name with a leading slash.
    name: c.Name.replace(/^\//, ''),
    image: c.Config.Image,
    state: c.State.Status,
    project_id: c.Config.Labels?.[LABEL_PROJECT],
    user_container_id: containerIdFromLabels(c.Config.Labels),
    networks: Object.keys(c.NetworkSettings.Networks ?? {}),
  }));
};

/**
 * Create the network if it is not there.
 *
 * Idempotent because a deployment declares its networks on every run — that is
 * the normal case, not a mistake — and because two placements landing at once
 * would otherwise race to create the same one.
 */
export const ensureNetwork = async (
  exec: TDockerExec,
  name: string
): Promise<void> => {
  const existing = (
    await exec([
      'network',
      'ls',
      '--filter',
      `name=^${name}$`,
      '--format',
      '{{.Name}}',
    ])
  ).trim();

  if (existing === name) return;

  try {
    await exec(['network', 'create', name]);
  } catch (error) {
    // Lost the race with another placement; the network exists either way,
    // which is all this function promises.
    const message = (error as Error).message ?? '';
    if (!/already exists/i.test(message)) throw error;
  }
};

export const connectNetwork = (
  exec: TDockerExec,
  network: string,
  containerId: string
): Promise<string> => exec(['network', 'connect', network, containerId]);

export const disconnectNetwork = (
  exec: TDockerExec,
  network: string,
  containerId: string
): Promise<string> => exec(['network', 'disconnect', network, containerId]);

export const startExisting = (
  exec: TDockerExec,
  containerId: string
): Promise<string> => exec(['start', containerId]);

export const stopContainer = (
  exec: TDockerExec,
  containerId: string
): Promise<string> => exec(['stop', containerId]);

export const removeContainer = (
  exec: TDockerExec,
  containerId: string
): Promise<string> => exec(['rm', '--force', containerId]);
