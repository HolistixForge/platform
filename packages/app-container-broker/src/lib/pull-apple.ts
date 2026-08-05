import { TResolvedImage, TRuntimeExec } from './types';
import { registryHost } from './pull';

/**
 * Pulling under Apple `container`.
 *
 * The rule about *when* to pull is the Docker file's and does not change: a
 * built-in already on the host is used as-is, a tenant image is fetched on
 * every single start. The layer cache is shared, so once one project has
 * pulled a private image any other project naming the same digest would
 * otherwise get it without proving access; the manifest fetch is the part that
 * checks the token, and it has to happen every time.
 *
 * What changes is how the credential is carried. Docker gets a throw-away
 * `--config` directory per pull, so two projects pulling at once cannot lend
 * each other access. Apple `container` has no per-invocation credential store
 * at all — `container registry login` writes one host-wide store, and
 * `container image pull` takes no credential flag. That is the
 * `registry-login-is-host-wide` concession.
 *
 * A queue closes the window rather than narrowing it: while one tenant pull
 * holds the login, no other pull runs. It costs concurrency between two
 * private pulls on one host, which is latency, against a credential crossing
 * between tenants, which is not.
 *
 * Verified against the real GHCR as far as it can be from here: this exact
 * argv parses, the token is read from stdin, and the registry answers `401
 * access denied` for a token that is not one. A *successful* pull with a
 * minted installation token needs a real Ganymede and has not been run.
 */

let queue: Promise<unknown> = Promise.resolve();

/** Run `work` after every pull already queued, whether those passed or not. */
const serialised = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.then(work, work);
  // The chain must survive a rejection; the caller still gets it via `next`.
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
};

const pullTenantImage = (
  exec: TRuntimeExec,
  image: TResolvedImage
): Promise<void> =>
  serialised(async () => {
    const host = registryHost(image.reference);
    try {
      // The token goes over stdin, never argv: an argv element is readable in
      // `ps` by every user on the host, and `--password-stdin` is the only
      // form this CLI offers anyway.
      await exec(
        [
          'registry',
          'login',
          '--username',
          'x-access-token',
          '--password-stdin',
          '--',
          host,
        ],
        image.pullToken
      );
      await exec(['image', 'pull', '--', image.reference]);
    } finally {
      // Even on failure. A login left behind is an ambient credential, and
      // under this engine `container run` will pull with one — see the
      // `run-may-pull` concession and `applePreflight`.
      await exec(['registry', 'logout', '--', host]).catch(() => '');
    }
  });

export const pullAppleImage = async (
  exec: TRuntimeExec,
  image: TResolvedImage
): Promise<void> => {
  if (image.builtin) {
    const present = await exec(['image', 'inspect', '--', image.reference])
      .then(() => true)
      .catch(() => false);
    if (present) return;

    await exec(['image', 'pull', '--', image.reference]);
    return;
  }

  if (!image.pullToken) {
    throw new Error(
      `image ${image.imageId} needs a pull token and carries none`
    );
  }

  await pullTenantImage(exec, image);
};

/**
 * Refuse to serve while this host holds a registry login.
 *
 * The `run-may-pull` concession records that `container run` fetches a missing
 * image by itself — measured, not assumed. That is only harmless while there
 * is no credential for it to fetch with: otherwise a project could name a
 * digest it has no access to, have the broker's pull refused, and have the run
 * quietly fetch it anyway under whoever is logged in.
 *
 * A refusal rather than a sweep. The logins on a host belong to the operator,
 * and a service that silently logs someone out of their own registry is worse
 * than one that says why it will not start.
 */
export const applePreflight = async (exec: TRuntimeExec): Promise<void> => {
  const out = await exec(['registry', 'list', '--format', 'json']).catch(
    () => ''
  );
  if (!out) return;

  let entries: unknown;
  try {
    entries = JSON.parse(out);
  } catch {
    return;
  }
  if (!Array.isArray(entries) || entries.length === 0) return;

  const hosts = entries
    .map((e) => {
      const row = (e ?? {}) as Record<string, unknown>;
      return String(row.host ?? row.hostname ?? '');
    })
    .filter(Boolean)
    .join(', ');

  throw new Error(
    `this host holds registry logins (${hosts || 'unnamed'}). ` +
      'Under the apple engine a run can pull with them; clear them with ' +
      '`container registry logout <host>` before starting the broker'
  );
};
