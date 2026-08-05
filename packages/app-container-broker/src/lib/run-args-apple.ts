import {
  TStartRequest,
  TBrokerConfig,
  TResolvedImage,
  BASELINE_CAPABILITIES,
} from './types';
import { privateNetworkName } from './networks';

/**
 * Build the argv for one container start under Apple `container`.
 *
 * The same shape as the Docker translator, and deliberately a separate
 * function rather than the same one with conditionals: the two vocabularies
 * differ in what they *cannot* say, and a shared builder would express that as
 * skipped `push` calls — a control silently absent from the argv, which is
 * exactly the failure mode the concession list exists to prevent. Here every
 * gap is a comment naming the concession that covers it.
 *
 * An array, never a string. Nothing here is ever handed to a shell, so a value
 * that happens to contain a quote or a semicolon is a value and not a command.
 * `validateStartRequest` has already rejected anything that could be read as a
 * flag.
 *
 * Measured against `container` 1.2.0 on macOS 26.5.2: `--cap-drop=ALL`,
 * repeated `--network`, `--ulimit nproc=N:N` and a digest-pinned reference
 * after `--` are all accepted, and `container inspect` reads every one of them
 * back.
 */
export const buildAppleRunArgs = (
  request: TStartRequest,
  image: TResolvedImage,
  config: TBrokerConfig
): string[] => {
  const args = [
    'run',
    '--detach',
    // Apple's `--runtime` names a runtime handler rather than an OCI runtime,
    // and it is set from broker configuration for the same reason Docker's is:
    // what a container runs under is not something a request gets a say in.
    // Unlike Docker there is no unsafe value to fall back to — every handler
    // here boots a VM — but the value still has to be stated.
    `--runtime=${config.runtime}`,
    '--name',
    request.name,
    // No `--restart`: concession `restart-policy`. A container that dies stays
    // dead until something restarts it — the platform host's supervisor, or
    // the runner loop, which reconverges on every pass anyway.
    '--label',
    `holistix.organization=${request.organization_id}`,
    '--label',
    `holistix.project=${request.project_id}`,
    '--label',
    `holistix.user_container=${request.user_container_id}`,
    // A private network of its own, never a shared default. `--network` is
    // repeatable here, so a container *can* be started on several networks —
    // what does not exist is attaching one that is already running, which is
    // concession `no-hot-network-attach`.
    `--network=${privateNetworkName(request.user_container_id)}`,
  ];

  args.push('--cap-drop=ALL');
  for (const capability of BASELINE_CAPABILITIES) {
    args.push(`--cap-add=${capability}`);
  }
  for (const capability of request.capabilities) {
    args.push(`--cap-add=${capability}`);
  }
  // No `--security-opt=no-new-privileges`: concession `no-new-privileges`.
  // Nothing here replaces it. A setuid binary inside the guest can still
  // regain what the drop above took away; what changed is the blast radius,
  // which is the guest kernel rather than the host's.

  // No `--device`, ever, and none is needed: the guest kernel provides
  // /dev/net/tun itself (verified — `crw------- 10, 200` inside a container
  // started with none). Under this engine host device passthrough has no
  // expression at all, so what the Docker path refuses by policy is refused
  // here by construction.

  args.push(`--cpus=${request.limits.cpus}`);
  args.push(`--memory=${request.limits.memoryMb}m`);
  // No `--memory-swap`: the guest is booted without swap (`free -m` reports
  // 0), so the memory limit is hard by construction rather than by making the
  // two numbers equal. This is the one place the Apple engine is stronger and
  // it costs a flag rather than yielding one.

  // No `--pids-limit`: concession `pids-cgroup`. `RLIMIT_NPROC` is a per-uid
  // ceiling enforced at fork by the guest kernel, not a cgroup `pids.max` over
  // the whole container — two uids inside the guest get the ceiling each. It
  // caps a fork bomb and it is not the same control.
  args.push(
    '--ulimit',
    `nproc=${request.limits.pidsLimit}:${request.limits.pidsLimit}`
  );

  // No `--add-host`. Not a concession: `validateStartRequest` refuses a start
  // that carries `extra_hosts` under an engine that cannot honour them, rather
  // than starting a container that silently cannot resolve its gateway.

  args.push('--env', `SETTINGS=${request.settings}`);

  // No `--pull=never`: concession `run-may-pull`. `container run` does fetch a
  // missing image (measured), so the flag's guarantee is gone. What replaces
  // it is that there is nothing to fetch *with* — the pull already ran, and
  // `preflight` refuses to start the broker while any ambient registry login
  // exists on this host.

  // `--` so an image reference can never be read as a flag, whatever the
  // catalogue holds.
  args.push('--', image.reference);

  return args;
};
