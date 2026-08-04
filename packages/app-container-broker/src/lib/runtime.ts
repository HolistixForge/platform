import { execFile } from 'node:child_process';
import { TStartRequest, TBrokerConfig, TResolvedImage } from './types';
import { buildRunArgs } from './run-args';

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

export const startContainer = async (
  exec: TRuntimeExec,
  request: TStartRequest,
  image: TResolvedImage,
  config: TBrokerConfig
): Promise<string> => exec(buildRunArgs(request, image, config));

/**
 * Stop and remove a container by the id the runtime gave us.
 */
export const removeContainer = async (
  exec: TRuntimeExec,
  containerId: string
): Promise<void> => {
  await exec(['rm', '--force', '--', containerId]);
};
