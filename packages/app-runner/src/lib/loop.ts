import { EPriority, log } from '@holistix-forge/log';

import { TRunnerCredentials } from './credentials';
import { sendHeartbeats } from './heartbeat';
import { fetchProjects, RunnerRevoked, TRunnerProject } from './projects';

/**
 * The worker loop: ask, announce, reconcile, wait.
 *
 * Polling and not a subscription. A machine that was closed for a week comes
 * back and finds out what changed in one call, with no reconnection dance and
 * no missed-message problem — and a runner that is asleep costs the platform
 * nothing to have forgotten about. The cost is latency on a placement, which
 * for something a person just clicked is one poll interval.
 *
 * Every pass re-asks which projects this machine is in. That is what makes a
 * project taken away take effect: it stops appearing, and its short-lived
 * token expires on its own rather than needing to be revoked.
 */

export type TLoopDeps = {
  credentials: TRunnerCredentials;
  /** Injected so a pass can be run once, in a test, without a clock. */
  fetchImpl?: typeof fetch;
  /**
   * What to do with the placements of one project.
   *
   * Injected because it is the half that touches Docker, and because the
   * placement feed itself is not built yet — see `runOnce` below.
   */
  reconcileProject?: (project: TRunnerProject) => Promise<void>;
  intervalMs?: number;
  /** Resolves when the loop should stop. */
  stop?: Promise<void>;
};

export type TPassResult = {
  projects: number;
  heartbeats: { ok: number; failed: number };
  revoked: boolean;
};

/**
 * One pass. Everything the loop does, without the waiting.
 *
 * Separated so it can be run once and asserted on, and so `runner run --once`
 * is the same code path a long-running runner takes rather than a second
 * implementation of it.
 */
export const runOnce = async ({
  credentials,
  fetchImpl = fetch,
  reconcileProject,
}: TLoopDeps): Promise<TPassResult> => {
  let projects: TRunnerProject[];

  try {
    projects = await fetchProjects(credentials, fetchImpl);
  } catch (error) {
    if (error instanceof RunnerRevoked) {
      // Not a fault to retry: someone disconnected this machine, and the loop
      // should stop rather than knock at a door that is now closed.
      return { projects: 0, heartbeats: { ok: 0, failed: 0 }, revoked: true };
    }
    throw error;
  }

  // Announced before anything is reconciled. A machine that is up but slow to
  // converge is still a machine the project can see, and the catalog's 30
  // second threshold does not care why a runner went quiet.
  const beats = await sendHeartbeats(
    projects,
    credentials.runner_id,
    credentials.label,
    fetchImpl
  );

  if (reconcileProject) {
    for (const project of projects) {
      try {
        await reconcileProject(project);
      } catch (error) {
        // One project's reconciliation failing must not stop the others: they
        // are separate grants on separate gateways, and a machine in four
        // projects should not go dark in all of them for one.
        log(
          EPriority.Error,
          'RUNNER_LOOP',
          `Reconciling ${project.project_name} failed: ${
            (error as Error).message
          }`
        );
      }
    }
  }

  return {
    projects: projects.length,
    heartbeats: {
      ok: beats.filter((b) => b.ok).length,
      failed: beats.filter((b) => !b.ok).length,
    },
    revoked: false,
  };
};

const wait = (ms: number, stop?: Promise<void>): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // A pending wait must not be what keeps the process alive when the loop
    // has been asked to stop.
    timer.unref?.();
    stop?.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Run until revoked, or until `stop` resolves.
 *
 * A failed pass is logged and retried on the next tick rather than ending the
 * loop. The platform being unreachable is the normal condition of a laptop —
 * a closed lid, a train, a hotel network — and a runner that gave up on the
 * first refusal would need a human to start it again every morning.
 */
export const run = async (deps: TLoopDeps): Promise<void> => {
  const intervalMs = deps.intervalMs ?? 15_000;
  let stopped = false;
  deps.stop?.then(() => (stopped = true));

  log(
    EPriority.Info,
    'RUNNER_LOOP',
    `Running as "${deps.credentials.label}" (${deps.credentials.runner_id}) against ${deps.credentials.ganymedeUrl}`
  );

  while (!stopped) {
    try {
      const result = await runOnce(deps);

      if (result.revoked) {
        log(
          EPriority.Warning,
          'RUNNER_LOOP',
          'This machine is no longer enrolled. Stopping.'
        );
        return;
      }

      log(EPriority.Debug, 'RUNNER_LOOP', 'Pass complete', {
        projects: result.projects,
        ...result.heartbeats,
      });
    } catch (error) {
      log(
        EPriority.Warning,
        'RUNNER_LOOP',
        `Pass failed, retrying in ${intervalMs / 1000}s: ${
          (error as Error).message
        }`
      );
    }

    if (stopped) return;
    await wait(intervalMs, deps.stop);
  }
};
