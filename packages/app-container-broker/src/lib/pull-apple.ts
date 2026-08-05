import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { TResolvedImage, TRuntimeExec } from './types';
import { collectOciLayout, TFetchBlob } from './oci-archive';

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
 * How the credential is carried is where this used to go wrong, and the fix
 * turned out to cost nothing. `container registry login` *performs* the
 * registry's token exchange — it trades a credential for a bearer — and
 * Ganymede does not send a credential. It sends the result of that exchange, a
 * bearer scoped to one repository, for minutes, pull only. Login refused it,
 * measured, 401, while the same token answered 200 on `/v2/` and on the
 * manifest as a `Bearer`.
 *
 * So the engine is not asked to authenticate at all. The broker holds the
 * bearer, fetches the image itself, and hands over an archive — see
 * `oci-archive.ts`. No credential is installed on this host at any point,
 * which is strictly better than the queue that used to serialise pulls around
 * a host-wide login: there is no window left to serialise.
 */

/** Where the bearer is spent. Injected so the traversal is testable. */
export const httpsFetchBlob: TFetchBlob = async (url, headers) => {
  const response = await fetch(url, { headers });
  return {
    ok: response.ok,
    status: response.status,
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
};

const sha256 = (bytes: Uint8Array): string =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/**
 * `tar`, spawned with an argv array so nothing in a path reaches a shell.
 *
 * A hand-written ustar came first and `image load` refused what it produced —
 * `unable to open the archive, code -30`. Fifty lines of bit-twiddling on the
 * path a tenant image takes onto a platform host, to avoid a binary that is
 * already on every host this runs on.
 */
const tar = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile('tar', args, { timeout: 300_000 }, (error, _out, stderr) => {
      if (error) {
        reject(new Error(`tar failed: ${stderr.trim() || error.message}`));
        return;
      }
      resolve();
    });
  });

/**
 * Fetch a tenant image with its own token and load it into the engine.
 *
 * The archive goes to a private temp directory and is removed even on failure:
 * it holds a tenant's image, and nothing about it should outlive the request
 * that asked for it.
 */
const pullTenantImage = async (
  exec: TRuntimeExec,
  image: TResolvedImage,
  fetchBlob: TFetchBlob
): Promise<void> => {
  const entries = await collectOciLayout(
    image.reference,
    image.pullToken as string,
    fetchBlob,
    sha256
  );

  const dir = await mkdtemp(join(tmpdir(), 'holistix-oci-'));
  try {
    const layout = join(dir, 'layout');
    for (const entry of entries) {
      const target = join(layout, entry.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, entry.bytes, { mode: 0o600 });
    }

    const archive = join(dir, 'image.tar');
    await tar(['-cf', archive, '-C', layout, '.']);
    await exec(['image', 'load', '--input', archive]);
  } finally {
    // Even on failure: this holds a tenant's image and should not outlive the
    // request that asked for it.
    await rm(dir, { recursive: true, force: true });
  }
};

export const pullAppleImage = async (
  exec: TRuntimeExec,
  image: TResolvedImage,
  fetchBlob: TFetchBlob = httpsFetchBlob
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

  await pullTenantImage(exec, image, fetchBlob);
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

  // `name` and `id` are what `container registry list --format json` actually
  // carries — measured against a real login, where guessing `host` produced
  // "this host holds registry logins (unnamed)": a refusal the operator cannot
  // act on, which is most of the value of refusing. `host`/`hostname` stay in
  // the list so a future field rename degrades to naming one rather than none.
  const hosts = entries
    .map((e) => {
      const row = (e ?? {}) as Record<string, unknown>;
      return String(row.name ?? row.id ?? row.host ?? row.hostname ?? '');
    })
    .filter(Boolean)
    .join(', ');

  throw new Error(
    `this host holds registry logins (${hosts || 'unnamed'}). ` +
      'Under the apple engine a run can pull with them; clear them with ' +
      '`container registry logout <host>` before starting the broker'
  );
};
