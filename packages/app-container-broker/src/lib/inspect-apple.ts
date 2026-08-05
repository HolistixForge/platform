import { TRuntimeExec } from './types';

/**
 * Read one object out of `container inspect`.
 *
 * Docker answers a Go template; Apple `container` has no `--format` at all and
 * answers JSON, always, wrapped in an array even for one id. Every field the
 * broker reads is there — this is only a different shape, not a smaller one:
 *
 *   configuration.labels                    labels
 *   configuration.capDrop / capAdd          capabilities, `CAP_`-prefixed on the way out
 *   configuration.resources.cpus            cpu allocation
 *   configuration.resources.memoryInBytes   memory limit
 *   configuration.initProcess.rlimits       RLIMIT_NPROC, standing in for pids
 *   configuration.image.descriptor.digest   what actually started
 *   configuration.runtimeHandler            the runtime
 *   status.state                            running / stopped
 *   status.networks[].ipv4Address           addresses, one per network
 *
 * Note that `configuration.image.reference` is normalised: asking for
 * `repo:tag@sha256:…` gives back `repo@sha256:…`. Anything comparing what
 * started against what was asked for has to compare the digest, not the
 * reference.
 *
 * A missing object is '' and then `undefined`, never a throw — every caller
 * asks in order to act on absence.
 */
export const inspectApple = async (
  exec: TRuntimeExec,
  args: string[]
): Promise<Record<string, unknown> | undefined> => {
  const out = await exec(args).catch(() => '');
  if (!out) return undefined;

  try {
    const parsed = JSON.parse(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return typeof first === 'object' && first !== null
      ? (first as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/** One label off a container, or '' when the container is not there. */
export const appleContainerLabel = async (
  exec: TRuntimeExec,
  name: string,
  key: string
): Promise<string> => {
  const doc = await inspectApple(exec, ['inspect', '--', name]);
  const configuration = doc?.configuration as
    | Record<string, unknown>
    | undefined;
  const labels = configuration?.labels as Record<string, string> | undefined;
  return labels?.[key] ?? '';
};
