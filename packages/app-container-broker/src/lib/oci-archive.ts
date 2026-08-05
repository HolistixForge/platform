/**
 * Fetch an image from a registry and hand it to the engine as an archive.
 *
 * This exists because of what a `docker login` / `container registry login`
 * actually does: it *performs* the registry's token exchange, trading a
 * credential for a bearer. Ganymede deliberately does not send a credential —
 * it sends the result of that exchange, a bearer scoped to one repository, for
 * minutes, pull only. There is nothing left in it to trade, so login refuses
 * it. Measured against real GHCR: the same token answers 200 on `/v2/` and on
 * the manifest as a `Bearer`, and 401 through `registry login`.
 *
 * The way out that costs no scope is to not ask the engine to authenticate at
 * all. We hold the bearer, we fetch, and the engine is handed bytes:
 *
 *   GET  /v2/<repo>/manifests/<digest>     the index, verbatim
 *   GET  /v2/<repo>/manifests/<each>       every manifest it names
 *   GET  /v2/<repo>/blobs/<each>           configs and layers
 *   →    an OCI layout, tarred
 *   →    `container image load -i …`
 *
 * What that buys, beyond working: no credential is ever installed on the host,
 * so there is no window in which one pull's token could serve another's, and
 * the `registry-login-is-host-wide` concession goes away rather than being
 * accepted. Every blob is checked against the digest that named it, so a
 * registry that answers with something else is refused here rather than run.
 *
 * Two costs, both stated:
 *
 * - `index.json` is the registry's index **byte for byte**, because its digest
 *   is the one the catalogue pinned and the one the run asks for. Annotating it
 *   with a tag would change those bytes and therefore that digest.
 * - Which means every manifest the index names has to be present: `image load`
 *   refuses an index with a manifest missing, `--force` included. So all
 *   platforms are fetched, not just the host's. That is not a regression —
 *   `container image pull` already fetches the whole index.
 */

const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(',');

export class RegistryError extends Error {}

/** `ghcr.io/acme/etl:1.4.0@sha256:…` → its three useful parts. */
export const parseReference = (
  reference: string
): { host: string; repository: string; digest: string } => {
  const [withoutDigest, digest] = reference.split('@');
  if (!digest || !/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new RegistryError(`reference is not digest-pinned: ${reference}`);
  }
  // The tag is discarded on purpose: what is fetched is the digest, and the
  // tag is only there to be readable.
  const path = withoutDigest.split(':')[0];
  const slash = path.indexOf('/');
  if (slash < 0) {
    throw new RegistryError(`reference names no repository: ${reference}`);
  }
  return {
    host: path.slice(0, slash),
    repository: path.slice(slash + 1),
    digest,
  };
};

export type TFetchBlob = (
  url: string,
  headers: Record<string, string>
) => Promise<{ ok: boolean; status: number; bytes: Uint8Array }>;

export type TDigestOf = (bytes: Uint8Array) => string;

/** One entry of the layout: where it goes and what it holds. */
export type TArchiveEntry = { path: string; bytes: Uint8Array };

const isManifestList = (mediaType?: string): boolean =>
  mediaType === 'application/vnd.oci.image.index.v1+json' ||
  mediaType === 'application/vnd.docker.distribution.manifest.list.v2+json';

/**
 * Walk an image from its index down to every blob, checking as it goes.
 *
 * Returns the files of an OCI layout. Nothing is written here and nothing is
 * spawned, so the whole traversal — including a registry that lies about a
 * digest — is testable without a network or a daemon.
 */
export const collectOciLayout = async (
  reference: string,
  pullToken: string,
  fetchBlob: TFetchBlob,
  digestOf: TDigestOf
): Promise<TArchiveEntry[]> => {
  const { host, repository, digest } = parseReference(reference);
  const base = `https://${host}/v2/${repository}`;
  const auth = { Authorization: `Bearer ${pullToken}` };

  const get = async (
    url: string,
    accept: string,
    expected?: string
  ): Promise<Uint8Array> => {
    const response = await fetchBlob(url, { ...auth, Accept: accept });
    if (!response.ok) {
      throw new RegistryError(
        `${host} refused ${url.slice(base.length)} (${response.status})`
      );
    }
    // Every byte is checked against the digest that named it. A registry
    // answering with something else is refused here rather than run — which
    // is the whole point of pinning a digest in the first place.
    if (expected) {
      const actual = digestOf(response.bytes);
      if (actual !== expected) {
        throw new RegistryError(
          `${url.slice(base.length)} answered ${actual}, not ${expected}`
        );
      }
    }
    return response.bytes;
  };

  const entries: TArchiveEntry[] = [
    {
      path: 'oci-layout',
      bytes: new TextEncoder().encode(
        JSON.stringify({ imageLayoutVersion: '1.0.0' })
      ),
    },
  ];
  const seen = new Set<string>();

  const addBlob = (d: string, bytes: Uint8Array) => {
    if (seen.has(d)) return;
    seen.add(d);
    entries.push({ path: `blobs/sha256/${d.slice('sha256:'.length)}`, bytes });
  };

  // `already` is the root's bytes, which the caller has because its digest is
  // what index.json must hold verbatim. Passing them in rather than fetching
  // the index a second time.
  const walk = async (target: string, already?: Uint8Array): Promise<void> => {
    const raw =
      already ??
      (await get(`${base}/manifests/${target}`, MANIFEST_TYPES, target));
    addBlob(target, raw);

    const doc = JSON.parse(new TextDecoder().decode(raw)) as {
      mediaType?: string;
      manifests?: { digest: string }[];
      config?: { digest: string };
      layers?: { digest: string }[];
    };

    if (isManifestList(doc.mediaType) && doc.manifests) {
      // Every platform, not only this host's — see the note at the top.
      for (const child of doc.manifests) await walk(child.digest);
      return;
    }

    for (const blob of [
      ...(doc.config ? [doc.config] : []),
      ...(doc.layers ?? []),
    ]) {
      if (seen.has(blob.digest)) continue;
      addBlob(
        blob.digest,
        await get(`${base}/blobs/${blob.digest}`, '*/*', blob.digest)
      );
    }
  };

  const indexRaw = await get(
    `${base}/manifests/${digest}`,
    MANIFEST_TYPES,
    digest
  );
  // Verbatim, because its digest is the one the catalogue pinned and the one
  // the run will ask for. Annotating it with a tag would change both.
  entries.push({ path: 'index.json', bytes: indexRaw });
  await walk(digest, indexRaw);

  return entries;
};

/**
 * Where each entry goes, relative to the layout root.
 *
 * Writing the layout out and calling `tar` rather than emitting the archive
 * here. A hand-written ustar was the first attempt and `image load` refused it
 * — `unable to open the archive, code -30` — which is the kind of bug worth
 * not having on the path a tenant image takes onto a platform host. `tar` is
 * on every host this runs on and is not a dependency to add.
 */
export const layoutPaths = (entries: TArchiveEntry[]): string[] =>
  entries.map((e) => e.path);
