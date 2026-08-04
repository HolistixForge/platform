import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';

/**
 * Build the argv for one container start.
 *
 * An array, never a string. Nothing here is ever handed to a shell, so a value
 * that happens to contain a quote or a semicolon is a value and not a command.
 * `validateStartRequest` has already rejected anything that could be read as a
 * flag.
 *
 * The image reference is the resolved one — the caller looked it up from an
 * `image_id` against the catalogue. It is not, and must never be, whatever the
 * gateway sent.
 */
export const buildRunArgs = (
  request: TStartRequest,
  image: TResolvedImage,
  config: TBrokerConfig
): string[] => {
  const args = [
    'run',
    '--detach',
    // Every start goes through the configured runtime. A container that fell
    // back to runc would share the host kernel with every other tenant, which
    // is the one outcome this whole path exists to prevent — so it is set here,
    // from broker configuration, and is not something a request can influence.
    `--runtime=${config.runtime}`,
    '--name',
    request.name,
    // Restart on failure but not forever: a container that cannot start should
    // surface as stopped rather than spin.
    '--restart=on-failure:3',
    // Labels are how the reaper finds what belongs to whom.
    '--label',
    `holistix.organization=${request.organization_id}`,
    '--label',
    `holistix.project=${request.project_id}`,
    '--label',
    `holistix.user_container=${request.user_container_id}`,
  ];

  // Drop everything, then add back only what the allowlist permitted. Docker's
  // default set is generous, and none of it is needed here beyond the VPN
  // client's NET_ADMIN.
  args.push('--cap-drop=ALL');
  for (const capability of request.capabilities) {
    args.push(`--cap-add=${capability}`);
  }
  // A container that can acquire new privileges can undo the drop above.
  args.push('--security-opt=no-new-privileges');

  args.push(`--cpus=${request.limits.cpus}`);
  args.push(`--memory=${request.limits.memoryMb}m`);
  // Without this, memory pressure spills into swap instead of failing, and the
  // limit stops meaning anything.
  args.push(`--memory-swap=${request.limits.memoryMb}m`);
  args.push(`--pids-limit=${request.limits.pidsLimit}`);

  for (const entry of request.extra_hosts) {
    args.push(`--add-host=${entry.host}:${entry.ip}`);
  }

  args.push('--env', `SETTINGS=${request.settings}`);

  // The pull already happened, with this project's credential and its own
  // config directory. Letting `run` fetch on its own would do it with the
  // host's ambient credentials instead — which is how a project ends up
  // starting an image it cannot actually pull.
  args.push('--pull=never');

  // `--` so an image reference can never be read as a flag, whatever the
  // catalogue holds.
  args.push('--', image.reference);

  return args;
};
