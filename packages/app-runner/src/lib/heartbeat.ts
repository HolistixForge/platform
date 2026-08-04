import { TRunnerProject } from './projects';

/**
 * The runner saying it is still here, once per project.
 *
 * Read on the same 30 second threshold as the container watchdog, by the same
 * periodic pass — deliberately, because two timeouts would eventually show a
 * live container on a dead machine, which is a state no one can act on.
 *
 * Per project and not once for the machine: the catalog is per project, and a
 * machine in three projects has to be visible in three rooms held by
 * potentially different gateways.
 */

/**
 * The gateway's periodic pass treats a machine as gone after 30 seconds, so
 * sending on that same period would mark it dead on the first packet that
 * arrives late. Half the threshold means one missed beat is survivable.
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

export type THeartbeatResult = {
  project_id: string;
  ok: boolean;
  error?: string;
};

/**
 * One beat to one project.
 *
 * The event carries the machine id and label; the *owner* is not in it and
 * must not be. The gateway's reducer takes that from the authenticated token,
 * and a runner that could name its own owner could enrol itself into a project
 * it was never invited to.
 */
export const sendHeartbeat = async (
  project: TRunnerProject,
  machine_id: string,
  label: string,
  fetchImpl: typeof fetch = fetch
): Promise<THeartbeatResult> => {
  try {
    const response = await fetchImpl(
      `https://${project.gateway_hostname}/collab/event`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Bearer, which is also what waives the CSRF gate for a request that
          // has no browser behind it.
          authorization: `Bearer ${project.token}`,
        },
        body: JSON.stringify({
          project_id: project.project_id,
          event: {
            type: 'user-container:runner-health',
            machine_id,
            label,
            systemEvent: true,
          },
        }),
      }
    );

    if (!response.ok) {
      return {
        project_id: project.project_id,
        ok: false,
        error: `${response.status} ${response.statusText}`,
      };
    }

    return { project_id: project.project_id, ok: true };
  } catch (error) {
    // A gateway that is down, or a project whose organization was stopped, is
    // not a reason to stop beating to the others.
    return {
      project_id: project.project_id,
      ok: false,
      error: (error as Error).message,
    };
  }
};

/**
 * A beat to every project, concurrently.
 *
 * Concurrently and not in sequence: one unreachable gateway would otherwise
 * delay every project behind it, and a machine in four projects would go
 * quiet in all of them because one was down.
 */
export const sendHeartbeats = (
  projects: TRunnerProject[],
  machine_id: string,
  label: string,
  fetchImpl: typeof fetch = fetch
): Promise<THeartbeatResult[]> =>
  Promise.all(
    projects.map((p) => sendHeartbeat(p, machine_id, label, fetchImpl))
  );
