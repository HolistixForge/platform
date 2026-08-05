import { TDockerExec, TRunningContainer } from './docker';
import { TPlacement } from './placement';

/**
 * The two engines a runner can drive on somebody's own machine.
 *
 * The same seam as the broker's, and for the same reason — but the machine is
 * different, and so is what is at stake. A platform host runs tenants beside
 * each other. A laptop runs *its owner's* work beside services other members
 * of their projects placed there, which the ticket names as the confused
 * deputy pointed at a person's own machine. Under Docker on a Mac every one of
 * those services shares the single VM's kernel. Apple `container` gives each
 * one its own guest kernel at level 1, so the owner is protected from the
 * other members of their own project.
 *
 * An addition, not a rewrite: the Docker entry is a table of the functions
 * that were already in `docker.ts`, under the names they already had.
 *
 * Whole operations, not primitives. `listOwned` is one call here rather than
 * "list ids" plus "inspect" because Apple has no label filter on `ls` and does
 * the filtering after inspecting — a difference that belongs inside the
 * engine, not spread through `reconcile`.
 */

/** Raised when a caller asks for something the configured engine cannot do. */
export class UnsupportedByEngine extends Error {}

/**
 * A control one engine has and the other cannot express.
 *
 * The same shape the broker uses, and named the same way, so an operator
 * reading both sees one vocabulary. What differs is who is told: the broker
 * refuses to start until an operator accepts its concessions, because a
 * platform host is somebody's deployment. A runner is a person's own laptop
 * and there is no operator to ask, so these are reported rather than gated —
 * `status` prints them, and the placement that cannot be honoured says which
 * concession stopped it.
 */
export type TEngineConcession = {
  id: string;
  /** The control that is not available. */
  control: string;
  /** What is actually lost, in a sentence — not what replaces it. */
  lost: string;
};

export type TRunnerEngine = {
  /** `docker` or `apple`. Printed by `status` and in every refusal. */
  name: string;
  /** Binary the exec front-end spawns when nothing overrides it. */
  binary: string;
  /** Whether a container started here gets its own kernel. */
  isMicroVm: boolean;
  concessions: TEngineConcession[];

  /** Every container this runner owns for a project, running or not. */
  listOwned: (
    exec: TDockerExec,
    project_id: string
  ) => Promise<TRunningContainer[]>;
  ensureNetwork: (exec: TDockerExec, name: string) => Promise<void>;
  /**
   * Attach a network to a container that is already running.
   *
   * Docker does this live, which is what lets reconciliation fix a placement
   * whose networks changed without stopping the service. Apple cannot, so its
   * entry throws `UnsupportedByEngine` and the caller recreates instead — the
   * `no-hot-network-attach` concession, made visible rather than skipped.
   */
  connectNetwork: (
    exec: TDockerExec,
    network: string,
    id: string
  ) => Promise<unknown>;
  disconnectNetwork: (
    exec: TDockerExec,
    network: string,
    id: string
  ) => Promise<unknown>;
  startExisting: (exec: TDockerExec, id: string) => Promise<unknown>;
  stopContainer: (exec: TDockerExec, id: string) => Promise<unknown>;
  removeContainer: (exec: TDockerExec, id: string) => Promise<unknown>;
  /** What a placement becomes on the command line of this engine. */
  runArgs: (placement: TPlacement, machine_id: string) => string[];
};

/**
 * Which engine to drive.
 *
 * Named, never sniffed. "Whichever binary is on the PATH" would silently pick
 * one on a machine that has both, and the two do not isolate the same way —
 * so which one ran somebody's container would depend on their install history.
 * The default is Docker because that is what every existing runner has.
 */
export const selectEngine = (
  name: string | undefined,
  engines: Record<string, TRunnerEngine>
): TRunnerEngine => {
  const key = (name || 'docker').toLowerCase();
  const engine = engines[key];
  if (!engine) {
    throw new Error(
      `Unknown container engine "${key}". Known: ${Object.keys(engines).join(
        ', '
      )}`
    );
  }
  return engine;
};
