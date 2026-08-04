import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TResolvedImage } from './types';
import { TRuntimeExec } from './runtime';

/**
 * The registry host a reference points at.
 *
 * `ghcr.io/owner/name:tag@sha256:…` → `ghcr.io`. A first segment with no dot
 * and no colon is a Docker Hub namespace rather than a host, which is the one
 * case where the reference has no explicit registry.
 */
export const registryHost = (reference: string): string => {
  const first = reference.split('/')[0];
  const looksLikeHost =
    first.includes('.') || first.includes(':') || first === 'localhost';
  return looksLikeHost ? first : 'docker.io';
};

/**
 * Pull an image using credentials that belong to one project.
 *
 * A per-project token cannot go through `docker login`: that writes to a
 * config shared by every pull on this host, so two projects pulling at once
 * race, and whichever wrote last lends its access to the other. Instead each
 * pull gets its own `--config` directory, used once and deleted.
 *
 * This runs on **every** start, including when the image is already on the
 * host. That is deliberate and is not a missed optimisation: the layer cache
 * is shared, so once one project has pulled a private image, any other project
 * naming the same digest would otherwise get it without ever proving it has
 * access. Pulling again is cheap — the layers are local — but the manifest
 * fetch still goes to the registry, and that is the part that checks the
 * token.
 */
export const pullImage = async (
  exec: TRuntimeExec,
  image: TResolvedImage
): Promise<void> => {
  if (!image.pullToken) {
    // A built-in image: ours, no tenant credential involved.
    await exec(['pull', '--', image.reference]);
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'holistix-pull-'));
  try {
    // The username is ignored by GHCR when the password is a token, but the
    // field has to be there for the config to parse.
    const auth = Buffer.from(`x-access-token:${image.pullToken}`).toString(
      'base64'
    );
    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ auths: { [registryHost(image.reference)]: { auth } } }),
      { mode: 0o600 }
    );

    await exec(['--config', dir, 'pull', '--', image.reference]);
  } finally {
    // Even on failure: a credential left in /tmp outlives the request that
    // needed it.
    await rm(dir, { recursive: true, force: true });
  }
};
