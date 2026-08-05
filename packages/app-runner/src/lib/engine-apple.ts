import {
  LABEL_CONTAINER,
  LABEL_MACHINE,
  LABEL_PROJECT,
  TDockerExec,
  TRunningContainer,
} from './docker';
import { TRunnerEngine, UnsupportedByEngine } from './engine';
import { TPlacement } from './placement';

/**
 * Apple `container`, on the machine of whoever enrolled this runner.
 *
 * Measured on `container` 1.2.0, macOS 26.5.2, M1 Pro. A container started
 * here is a VM with its own kernel — which is the reason to want it on a
 * laptop: once a machine joins a project, other members can place services on
 * it, and under Docker on a Mac all of them would share one kernel with the
 * owner's own work.
 */

/**
 * Apple's `inspect`, which is not Docker's.
 *
 * Docker returns `Name`, `Config.Labels`, `NetworkSettings.Networks`. Apple
 * returns `configuration.id`, `configuration.labels` and
 * `status.networks[].network`, and has no leading slash on the name. Reading
 * it as if it were Docker's yields a container with no labels — which
 * reconciliation reads as "not ours" and leaves running forever.
 */
type TAppleContainer = {
  configuration?: {
    id?: string;
    labels?: Record<string, string>;
    image?: { reference?: string };
  };
  status?: {
    state?: string;
    networks?: { network?: string }[];
  };
};

const toRunning = (c: TAppleContainer): TRunningContainer => {
  const cfg = c.configuration ?? {};
  const status = c.status ?? {};
  const labels = cfg.labels ?? {};
  return {
    id: cfg.id ?? '',
    name: cfg.id ?? '',
    image: cfg.image?.reference ?? '',
    state: status.state ?? 'unknown',
    project_id: labels[LABEL_PROJECT],
    user_container_id: labels[LABEL_CONTAINER],
    networks: (status.networks ?? [])
      .map((n) => n.network)
      .filter((n): n is string => Boolean(n)),
  };
};

const parse = (raw: string): TAppleContainer[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // An engine that answered something unparseable is not an engine that
    // answered "nothing here". Reconciliation would take the empty list as
    // "none of my containers exist" and start every one of them again.
    throw new Error(`Could not read the container list: ${raw.slice(0, 200)}`);
  }
};

/**
 * Filtered here, because `container ls` has no `--filter label=`.
 *
 * Docker does the same selection server-side. Doing it in code is the whole
 * reason `listOwned` is one operation in the engine table rather than a
 * "list ids" and an "inspect" the caller stitches together.
 */
const listOwned = async (
  exec: TDockerExec,
  project_id: string
): Promise<TRunningContainer[]> => {
  const raw = (await exec(['ls', '--all', '--format', 'json'])).trim();
  if (!raw) return [];
  return parse(raw)
    .map(toRunning)
    .filter((c) => c.project_id === project_id);
};

const ensureNetwork = async (
  exec: TDockerExec,
  name: string
): Promise<void> => {
  const existing = (await exec(['network', 'ls'])).split('\n');
  // Whole-line word match: a network called `proj` must not be answered for by
  // one called `proj-staging`.
  if (existing.some((line) => line.split(/\s+/).includes(name))) return;

  try {
    await exec(['network', 'create', name]);
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (!/already exists/i.test(message)) throw error;
  }
};

/**
 * Not available, and it says so.
 *
 * `container network connect` does not exist: a network is chosen when the
 * container is created. Reconciliation uses the live attach to fix a placement
 * whose networks changed without stopping the service; here the caller has to
 * recreate instead, and the refusal is what tells it to rather than a silent
 * no-op that would leave the container on the wrong network while every log
 * line says the pass succeeded.
 */
// `async` and not a plain throw: it is typed as returning a promise, and a
// caller reaching for `.catch()` on a function that throws synchronously gets
// an uncaught exception instead of the refusal it was handling.
const noHotAttach = async (): Promise<never> => {
  throw new UnsupportedByEngine(
    'engine apple cannot attach a network to a running container (no-hot-network-attach)'
  );
};

const runArgs = (placement: TPlacement, machine_id: string): string[] => [
  'run',
  '--detach',
  // No `--restart`. Apple has no restart policy at all — the concession named
  // below. What stands in is the loop: every pass restarts what exited.
  '--name',
  placement.name,
  '--label',
  `${LABEL_PROJECT}=${placement.project_id}`,
  '--label',
  `${LABEL_CONTAINER}=${placement.user_container_id}`,
  '--label',
  `${LABEL_MACHINE}=${machine_id}`,
  '--env',
  `SETTINGS=${placement.settings}`,
  ...placement.capabilities.flatMap((c) => ['--cap-add', c]),
  // Devices are dropped rather than passed. Under a microVM the container has
  // its own guest kernel, so `/dev/net/tun` is already there — measured,
  // `crw------- 10, 200`, with no `--device` given. Passing the host's node
  // would be meaningless here and a hole through the isolation elsewhere.
  ...placement.networks.slice(0, 1).flatMap((n) => ['--network', n]),
  '--',
  placement.imageRef,
];

export const appleEngine: TRunnerEngine = {
  name: 'apple',
  binary: 'container',
  isMicroVm: true,
  concessions: [
    {
      id: 'restart-policy',
      control: '--restart unless-stopped',
      lost: 'a container that exits stays down until the next pass restarts it, so a service can be down for up to one interval after a crash or a reboot',
    },
    {
      id: 'no-hot-network-attach',
      control: 'docker network connect/disconnect on a running container',
      lost: 'a placement whose networks changed cannot be corrected in place; the container is recreated, so the service restarts',
    },
    {
      id: 'no-add-host',
      control: '--add-host name:ip',
      lost: 'names are not injected into /etc/hosts by the engine; the container resolves the host from its own default route instead, which only images built on the platform base image do',
    },
  ],

  listOwned,
  ensureNetwork,
  connectNetwork: noHotAttach,
  disconnectNetwork: noHotAttach,
  startExisting: (exec, id) => exec(['start', id]),
  stopContainer: (exec, id) => exec(['stop', id]),
  removeContainer: (exec, id) => exec(['delete', '--force', id]),
  runArgs,
};
