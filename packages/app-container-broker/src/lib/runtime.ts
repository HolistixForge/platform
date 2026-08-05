import { execFile } from 'node:child_process';
import {
  TStartRequest,
  TBrokerConfig,
  TResolvedImage,
  TRuntimeExec,
} from './types';
import { TContainerEngine } from './engine';
import { privateNetworkName } from './networks';

export type { TRuntimeExec } from './types';

/**
 * Spawn the container engine.
 *
 * `execFile`, not `exec`: there is no shell, so the argv array reaches the
 * binary as-is and nothing in it can be interpreted as a command.
 *
 * `stdin`, when given, is written and the pipe closed — which is what
 * `--password-stdin` waits for. Apple `container` offers no other way to hand
 * over a registry credential, and this is the better way regardless: an argv
 * element is readable in `ps` by every user on the host.
 */
export const engineExec =
  (binary: string, timeoutMs = 120_000): TRuntimeExec =>
  (args, stdin) =>
    new Promise((resolve, reject) => {
      const child = execFile(
        binary,
        args,
        { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `${binary} ${args[0]} failed: ${stderr.trim() || error.message}`
              )
            );
            return;
          }
          resolve(stdout.trim());
        }
      );

      if (stdin !== undefined) child.stdin?.end(stdin);
    });

/**
 * Clear the way for a start that is really a restart.
 *
 * Starting a service that already runs is not an error — it is how someone
 * restarts one, or moves it between runners. Both engines disagree: the name
 * is taken, and the run fails with a conflict that says nothing useful to the
 * person who clicked.
 *
 * The container is only removed when its `holistix.user_container` label
 * matches the request. A name collision with anything else is left alone and
 * allowed to fail: this runs as root on the platform host, and "remove
 * whatever is in the way" is not a power this service should hold.
 */
const replaceExisting = async (
  engine: TContainerEngine,
  exec: TRuntimeExec,
  request: TStartRequest
): Promise<void> => {
  const owner = await engine.ownerOf(exec, request.name);
  if (owner !== request.user_container_id) return;

  await engine.removeContainer(exec, request.name);
};

/**
 * Fetch, then run.
 *
 * Two steps rather than letting the run pull implicitly, because the two need
 * different credentials: the pull uses the project's registry token, the run
 * uses nothing at all. Under Docker that second half is enforced with
 * `--pull=never`; under Apple `container` there is no such flag and the
 * guarantee comes from the host holding no ambient login — see the
 * `run-may-pull` concession.
 *
 * The order is the same on both engines, and so is this function. What differs
 * is which table of verbs it is handed.
 */
export const startContainer = async (
  engine: TContainerEngine,
  exec: TRuntimeExec,
  request: TStartRequest,
  image: TResolvedImage,
  config: TBrokerConfig
): Promise<string> => {
  await replaceExisting(engine, exec, request);
  await engine.pullImage(exec, image);
  // The container's own network has to exist before the run references it.
  await engine.ensureNetwork(
    exec,
    privateNetworkName(request.user_container_id),
    request.project_id
  );
  return exec(engine.buildRunArgs(request, image, config));
};

/**
 * Stop and remove a container by the id the engine gave us.
 */
export const removeContainer = async (
  engine: TContainerEngine,
  exec: TRuntimeExec,
  containerId: string
): Promise<void> => {
  await engine.removeContainer(exec, containerId);
};
