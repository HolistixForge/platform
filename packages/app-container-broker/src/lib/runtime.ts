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
          // stderr joins stdout rather than being dropped.
          //
          // Apple `container network delete` refuses an in-use network on
          // stderr and still exits 0, so a caller reading only stdout saw an
          // empty string and reported success — `DELETE /networks/:name`
          // answered 200 on a network that was still there. Anything deciding
          // on this output has to be able to see the refusal.
          //
          // Safe for the callers that read a value out of it: they compare
          // against an exact name or parse JSON, and both fail closed on
          // extra text — `networkExists` matches whole lines, `readLabel`
          // and `inspectApple` answer '' on anything they cannot parse.
          resolve([stdout.trim(), stderr.trim()].filter(Boolean).join('\n'));
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
  const output = await exec(engine.buildRunArgs(request, image, config));

  // The first line, not the whole output.
  //
  // `engineExec` joins stderr onto stdout, because a refused network delete is
  // reported there with a zero exit status and had to become visible. That is
  // the right call for the callers that *decide* on the output — and wrong for
  // this one, which uses it as a value. Apple `container run --detach` writes
  // the name on stdout and six lines of progress on stderr, so the returned
  // identifier came back as `holistix_…_uc_msgac\n[0/6] [0s]\n[1/6] …`.
  // Measured: `stdout` is exactly `id-probe`, every `[n/6]` line is stderr.
  //
  // That identifier is stored and later compared — ownership, removal,
  // reconciliation — so a polluted one is not cosmetic: nothing would ever
  // match it again, and the container becomes unremovable by the broker that
  // started it. stdout is joined first, so the identifier is the first line on
  // both engines; under Docker a pull notice lands on the lines after it.
  return output.split('\n')[0].trim();
};

/** Raised when a delete names something this broker did not start. */
export class NotOurs extends Error {}

/**
 * Stop and remove a container, and take its private network with it.
 *
 * Only a container this broker started. `replaceExisting` above already
 * refuses to remove what it does not own — "remove whatever is in the way" is
 * not a power a service running as root on the platform host should hold — and
 * this route had none of that check: `DELETE /containers/gw-pool-apollo-4`
 * would have taken down a gateway.
 *
 * The network goes too. `startContainer` creates one per container and nothing
 * removed it, so a long-lived host accumulated a /24 per service ever started
 * and eventually ran out of address space, at which point no service could
 * start at all. Its failure is tolerated: a network still referenced must not
 * turn a successful removal into an error, and under Apple `delete` returns
 * before the VM has released its interfaces — so the sweep is what the next
 * removal, or the reaper, finishes.
 */
export const removeContainer = async (
  engine: TContainerEngine,
  exec: TRuntimeExec,
  containerId: string
): Promise<void> => {
  const owner = await engine.ownerOf(exec, containerId);
  if (!owner) {
    throw new NotOurs(`${containerId} was not started by this broker`);
  }

  await engine.removeContainer(exec, containerId);
  await engine
    .removeNetwork(exec, privateNetworkName(owner))
    .catch(() => undefined);
};
