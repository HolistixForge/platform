import jwt from 'jsonwebtoken';

/**
 * GHCR access through a GitHub App installation.
 *
 * The chain is three hops, each narrower than the last:
 *
 *   App private key  →  app JWT (10 min, whole App)
 *                    →  installation token (1 h, one organization)
 *                    →  GHCR pull token (minutes, one repository, pull only)
 *
 * Only the last one leaves this process, and it is the narrowest thing in the
 * chain. The platform host never sees a credential that could do anything but
 * pull the one image it was asked for.
 *
 * The alternative — a tenant's personal access token — would be stored here in
 * full, handed out in full, and carry every access its owner has.
 */

export type TFetch = typeof fetch;

export type TGithubAppConfig = {
  appId: string;
  /** PEM, PKCS#1 or PKCS#8. */
  privateKey: string;
};

export class GithubAppError extends Error {}

/**
 * A JWT proving we are the App.
 *
 * GitHub rejects anything longer than ten minutes and is strict about clock
 * skew, hence the backdated `iat`.
 */
export const appJwt = (
  config: TGithubAppConfig,
  now: number = Math.floor(Date.now() / 1000)
): string =>
  jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: config.appId,
    },
    config.privateKey,
    { algorithm: 'RS256' }
  );

export type TInstallationToken = {
  token: string;
  expiresAt: string;
};

/**
 * Exchange the App JWT for a token scoped to one installation.
 */
export const installationToken = async (
  config: TGithubAppConfig,
  installationId: number | string,
  doFetch: TFetch = fetch
): Promise<TInstallationToken> => {
  const response = await doFetch(
    `https://api.github.com/app/installations/${encodeURIComponent(
      String(installationId)
    )}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt(config)}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (response.status === 404) {
    throw new GithubAppError(
      `GitHub App installation ${installationId} no longer exists`
    );
  }
  if (!response.ok) {
    throw new GithubAppError(
      `could not mint an installation token (${response.status})`
    );
  }

  const body = (await response.json()) as {
    token: string;
    expires_at: string;
  };
  return { token: body.token, expiresAt: body.expires_at };
};

/**
 * The `owner/name` part of a GHCR reference.
 *
 * `ghcr.io/acme/etl` → `acme/etl`. Anything that is not a GHCR reference is
 * refused rather than guessed at: this value becomes a registry scope, and a
 * wrong guess would ask for access to the wrong thing.
 */
export const ghcrRepository = (imageUri: string): string => {
  const parts = imageUri.split('/');
  if (parts[0] !== 'ghcr.io' || parts.length < 3) {
    throw new GithubAppError(`not a GHCR image reference: ${imageUri}`);
  }
  return parts.slice(1).join('/').toLowerCase();
};

/**
 * Trade an installation token for a GHCR bearer good for pulling one
 * repository.
 *
 * This is the only token that reaches the platform host. Its scope is a single
 * repository and a single action.
 */
export const ghcrPullToken = async (
  installationTokenValue: string,
  repository: string,
  doFetch: TFetch = fetch
): Promise<string> => {
  const basic = Buffer.from(
    `x-access-token:${installationTokenValue}`
  ).toString('base64');
  const response = await doFetch(
    `https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(
      `repository:${repository}:pull`
    )}`,
    { headers: { Authorization: `Basic ${basic}` } }
  );

  if (!response.ok) {
    throw new GithubAppError(
      `GHCR refused a pull token for ${repository} (${response.status})`
    );
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new GithubAppError(`GHCR returned no pull token for ${repository}`);
  }
  return body.token;
};

/**
 * Resolve a tag to the digest it currently points at.
 *
 * This is what lets a tenant supply a readable tag while the platform stores an
 * exact artifact — one HEAD request, so demanding a digest from the user buys
 * nothing but friction.
 *
 * The Accept header lists both the OCI and Docker manifest types, including the
 * index/list forms: a multi-architecture image answers with an index, and
 * omitting it gets either a 404 or the digest of one architecture rather than
 * of the image the user named.
 */
export const resolveDigest = async (
  pullToken: string,
  repository: string,
  tag: string,
  doFetch: TFetch = fetch
): Promise<string> => {
  const response = await doFetch(
    `https://ghcr.io/v2/${repository}/manifests/${encodeURIComponent(tag)}`,
    {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${pullToken}`,
        Accept: [
          'application/vnd.oci.image.index.v1+json',
          'application/vnd.oci.image.manifest.v1+json',
          'application/vnd.docker.distribution.manifest.list.v2+json',
          'application/vnd.docker.distribution.manifest.v2+json',
        ].join(','),
      },
    }
  );

  if (response.status === 404) {
    throw new GithubAppError(`${repository}:${tag} does not exist on GHCR`);
  }
  if (!response.ok) {
    throw new GithubAppError(
      `could not read the manifest for ${repository}:${tag} (${response.status})`
    );
  }

  const digest = response.headers.get('docker-content-digest');
  if (!digest || !/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new GithubAppError(
      `GHCR returned no usable digest for ${repository}:${tag}`
    );
  }
  return digest.slice('sha256:'.length);
};
