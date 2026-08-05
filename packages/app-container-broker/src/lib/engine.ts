import {
  TStartRequest,
  TBrokerConfig,
  TResolvedImage,
  TRuntimeExec,
} from './types';

/**
 * The two engines the broker can drive, and the seam between them.
 *
 * Docker is the Linux path: one host kernel, isolation borrowed from a microVM
 * runtime underneath (`--runtime=kata`). Apple `container` is the macOS path:
 * one VM per container by construction, on any Apple Silicon, with no nested
 * virtualisation to arrange. Both ship, and a deployment states which it runs.
 *
 * This is an addition, not a rewrite. Nothing on the Docker path changed: the
 * entry below is a table of the functions that were already there, under the
 * names they already had. The Apple engine is a second table pointing at new
 * files. Whole operations rather than fine-grained primitives, deliberately —
 * splitting `attachToNetwork` into "read both labels" and "connect" would have
 * moved the cross-project refusal out of the file it has always lived in, and
 * a security check is worth more sitting still than factored.
 */

/** Raised when a caller asks for something the configured engine cannot do. */
export class UnsupportedByEngine extends Error {}

/**
 * A control one engine has and the other cannot express.
 *
 * Deliberately not a boolean flag or a silently-skipped argument. A concession
 * is something the platform gives up, so it carries what was given up and what
 * the loss amounts to, and the operator has to name it before the broker will
 * serve. `--pids-limit` becoming `--ulimit nproc` is the case this shape
 * exists for: a substitute of a different nature, never to be passed off as
 * the same control.
 */
export type TEngineConcession = {
  /** Stable key the operator writes into `BROKER_ACCEPT_CONCESSIONS`. */
  id: string;
  /** The control that is not available. */
  control: string;
  /** What is actually lost, in a sentence — not what replaces it. */
  lost: string;
};

export type TContainerEngine = {
  /** `docker` or `apple`. Reported on `/health` and in a start response. */
  name: string;
  /** Binary the exec front-end spawns when nothing overrides it. */
  binary: string;
  /**
   * Whether a container started by this engine gets its own kernel.
   *
   * Under Docker it depends on the configured runtime — runc shares the host
   * kernel, kata does not. Under Apple `container` there is nothing to
   * configure: the container *is* a VM, so `/dev/net/tun` comes from the guest
   * and host device passthrough has no expression at all.
   */
  isMicroVm: (runtime: string) => boolean;
  /** Controls this engine cannot express. Empty for Docker. */
  concessions: readonly TEngineConcession[];
  /**
   * `--add-host`. Dev deployments use it to route `.local` names.
   *
   * When false, a start carrying `extra_hosts` is refused rather than started
   * without them: a container that cannot resolve its gateway fails later, in
   * a way that reads as a network fault instead of a missing flag.
   */
  supportsExtraHosts: boolean;

  buildRunArgs: (
    request: TStartRequest,
    image: TResolvedImage,
    config: TBrokerConfig
  ) => string[];

  /**
   * The `holistix.user_container` label on a container, or '' if there is none.
   *
   * What makes a start that is really a restart safe: only a container this
   * broker started for this same service is removed to free the name.
   */
  ownerOf: (exec: TRuntimeExec, name: string) => Promise<string>;

  pullImage: (exec: TRuntimeExec, image: TResolvedImage) => Promise<void>;

  ensureNetwork: (
    exec: TRuntimeExec,
    name: string,
    projectId: string
  ) => Promise<void>;
  attachToNetwork: (
    exec: TRuntimeExec,
    networkName: string,
    containerId: string
  ) => Promise<void>;
  detachFromNetwork: (
    exec: TRuntimeExec,
    networkName: string,
    containerId: string
  ) => Promise<void>;
  removeNetwork: (exec: TRuntimeExec, networkName: string) => Promise<void>;

  removeContainer: (exec: TRuntimeExec, containerId: string) => Promise<void>;

  /**
   * What has to be true of this host before the broker accepts a request.
   *
   * Runs once at startup and throws to stop the process. It is the place for a
   * property an engine cannot enforce per request — Apple's ambient registry
   * logins are the case it was added for.
   */
  preflight: (exec: TRuntimeExec) => Promise<void>;
};

/**
 * Refuse to start unless every concession has been written down.
 *
 * Both directions are errors. An unacknowledged concession would let a
 * deployment lose `no-new-privileges` by installing a different binary, which
 * is the loss-by-omission this service is arranged against. An acknowledgement
 * the engine does not make is a typo, or a config copied from the other engine
 * — and a config naming controls the running engine has never heard of is not
 * one to serve traffic on.
 */
export const assertConcessionsAccepted = (
  engine: TContainerEngine,
  accepted: string[]
): void => {
  const declared = new Set(engine.concessions.map((c) => c.id));
  const written = new Set(accepted);

  const unacknowledged = engine.concessions.filter((c) => !written.has(c.id));
  if (unacknowledged.length > 0) {
    const detail = unacknowledged
      .map((c) => `  ${c.id}: ${c.control} — ${c.lost}`)
      .join('\n');
    throw new Error(
      `engine ${engine.name} gives up controls that have not been accepted.\n` +
        `${detail}\n` +
        `Set BROKER_ACCEPT_CONCESSIONS to include: ${unacknowledged
          .map((c) => c.id)
          .join(',')}`
    );
  }

  const unknown = [...written].filter((id) => !declared.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `BROKER_ACCEPT_CONCESSIONS names ${unknown.join(', ')}, which engine ${
        engine.name
      } does not give up`
    );
  }
};

/**
 * Pick the engine a config asks for.
 *
 * A registry rather than a conditional, so a third engine is an entry here and
 * a file beside the other two.
 */
export const selectEngine = (
  config: TBrokerConfig,
  registry: Record<string, TContainerEngine>
): TContainerEngine => {
  const engine = registry[config.engine];
  if (!engine) {
    throw new Error(
      `BROKER_ENGINE must be one of ${Object.keys(registry).join(', ')}; got "${
        config.engine
      }"`
    );
  }
  assertConcessionsAccepted(engine, config.acceptedConcessions);
  return engine;
};
