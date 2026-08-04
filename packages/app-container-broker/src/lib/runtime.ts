import { execFile } from 'node:child_process';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';
import { buildRunArgs } from './run-args';
import { pullImage } from './pull';
import { ensureNetwork, privateNetworkName } from './networks';

/**
 * How a container is actually started.
 *
 * Injected so the argv-building and policy layers can be tested without a
 * container runtime, and so a different runtime front-end can be swapped in
 * without touching them.
 */
export type TRuntimeExec = (args: string[]) => Promise<string>;

/**
 * Spawn the container runtime.
 *
 * `execFile`, not `exec`: there is no shell, so the argv array reaches the
 * binary as-is and nothing in it can be interpreted as a command.
 */
export const dockerExec =
  (binary = 'docker', timeoutMs = 120_000): TRuntimeExec =>
  (args) =>
    new Promise((resolve, reject) => {
      execFile(
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
    });

/**
 * Clear the way for a start that is really a restart.
 *
 * Starting a service that already runs is not an error — it is how someone
 * restarts one, or moves it between runners. Docker disagrees: the name is
 * taken, and the run fails with a Conflict that says nothing useful to the
 * person who clicked.
 *
 * The container is only removed when its `holistix.user_container` label
 * matches the request. A name collision with anything else is left alone and
 * allowed to fail: this runs as root on the platform host, and "remove
 * whatever is in the way" is not a power this service should hold.
 */
const replaceExisting = async (
  exec: TRuntimeExec,
  request: TStartRequest
): Promise<void> => {
  const owner = await exec([
    'container',
    'inspect',
    '--format',
    '{{index .Config.Labels "holistix.user_container"}}',
    '--',
    request.name,
  ]).catch(() => '');

  if (owner.trim() !== request.user_container_id) return;

  await exec(['rm', '--force', '--', request.name]);
};

/**
 * Fetch, then run.
 *
 * Two steps rather than letting `docker run` pull implicitly, because the two
 * need different credentials: the pull uses the project's registry token, the
 * run uses nothing at all.
 */
export const startContainer = async (
  exec: TRuntimeExec,
  request: TStartRequest,
  image: TResolvedImage,
  config: TBrokerConfig
): Promise<string> => {
  await replaceExisting(exec, request);
  await pullImage(exec, image);
  // The container's own network has to exist before the run references it.
  await ensureNetwork(
    exec,
    privateNetworkName(request.user_container_id),
    request.project_id
  );
  return exec(buildRunArgs(request, image, config));
};

/**
 * Stop and remove a container by the id the runtime gave us.
 */
export const removeContainer = async (
  exec: TRuntimeExec,
  containerId: string
): Promise<void> => {
  await exec(['rm', '--force', '--', containerId]);
};
