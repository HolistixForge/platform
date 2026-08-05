import { TContainerEngine, TEngineConcession } from './engine';
import { buildAppleRunArgs } from './run-args-apple';
import { pullAppleImage, applePreflight } from './pull-apple';
import { appleContainerLabel } from './inspect-apple';
import {
  ensureAppleNetwork,
  attachToAppleNetwork,
  detachFromAppleNetwork,
  removeAppleNetwork,
} from './networks-apple';

/**
 * The macOS engine: Apple `container`, one VM per container.
 *
 * Not portability for its own sake. A Mac host is a real deployment target —
 * iOS builds need Apple hardware — and Apple Silicon before M3 has no nested
 * virtualisation, so a Linux VM on such a machine cannot run Kata at all. This
 * engine reaches microVM isolation at level 1, on any Apple Silicon, with
 * nothing to arrange.
 *
 * Measured on `container` 1.2.0, macOS 26.5.2, M1 Pro. A container started
 * with the broker's own vocabulary — `--cpus 1 --memory 256m --cap-drop ALL
 * --label holistix.project=… --network …` — boots kernel 6.18.15, reports
 * `memory.max = 268435456` inside the guest for a 256 MiB limit, has
 * `/dev/net/tun` from its own kernel with no device passed in, and no swap.
 *
 * Two places it is stronger than Docker, and neither costs anything:
 *
 *   no swap in the guest, so a memory limit is hard by construction rather
 *   than by setting `--memory-swap` equal to `--memory`
 *
 *   no `--device` at all, so what the Docker path refuses by policy under a
 *   microVM runtime is refused here by there being nothing to ask for
 *
 * What it cannot express is `CONCESSIONS`, named rather than absent. Nothing
 * on the Docker path was changed to accommodate any of it.
 */

const CONCESSIONS: readonly TEngineConcession[] = [
  {
    id: 'no-new-privileges',
    control: '--security-opt=no-new-privileges',
    lost: 'a setuid binary inside the guest can regain what --cap-drop=ALL took away; the reach is the guest kernel rather than the host, but the control itself is gone, not moved',
  },
  {
    id: 'pids-cgroup',
    control: '--pids-limit',
    lost: 'processes are capped by RLIMIT_NPROC per uid at fork, not by a cgroup pids.max over the whole container: two uids in one guest get the ceiling each',
  },
  {
    id: 'restart-policy',
    control: '--restart=on-failure:3',
    lost: 'a container that exits stays down until something outside restarts it — a supervisor on a platform host, or the runner loop, which reconverges every pass',
  },
  {
    id: 'run-may-pull',
    control: '--pull=never',
    lost: '`container run` fetches a missing image on its own, so the run is no longer structurally unable to reach a registry; what stands in is that no ambient credential is allowed to exist (see applePreflight)',
  },
  {
    id: 'no-hot-network-attach',
    control: 'docker network connect',
    lost: 'two services already running cannot be wired together; both have to be started on the shared network',
  },
];

export const appleEngine: TContainerEngine = {
  name: 'apple',
  binary: 'container',

  // Not a lookup against a list of runtimes: every container this engine
  // starts is a VM with its own kernel, whatever handler is named, so there is
  // no unsafe value to guard against.
  isMicroVm: () => true,

  concessions: CONCESSIONS,

  // `--add-host` does not exist. `--dns` does, so a deployment that needs
  // names has somewhere to go; what it cannot do is pin one host to one IP,
  // which is what the dev `.local` routes rely on.
  supportsExtraHosts: false,

  buildRunArgs: buildAppleRunArgs,

  ownerOf: (exec, name) =>
    appleContainerLabel(exec, name, 'holistix.user_container'),

  pullImage: pullAppleImage,

  ensureNetwork: ensureAppleNetwork,
  attachToNetwork: attachToAppleNetwork,
  detachFromNetwork: detachFromAppleNetwork,
  removeNetwork: removeAppleNetwork,

  removeContainer: async (exec, containerId) => {
    await exec(['delete', '--force', '--', containerId]);
  },

  preflight: applePreflight,
};
