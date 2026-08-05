import { pg } from '../database/pg';
import {
  TGithubAppConfig,
  TFetch,
  GithubAppError,
  ghcrRepository,
  ghcrPullToken,
  installationToken,
  resolveDigest,
} from './github-app';

export class ProjectImageError extends Error {}
export class UnknownProjectImage extends ProjectImageError {}
export class NoGithubLink extends ProjectImageError {}

export type TProjectImageRow = {
  image_id: string;
  image_name: string;
  description: string | null;
  image_uri: string;
  image_tag: string;
  image_sha256: string;
  github_organization: string | null;
  installation_id: string | null;
};

/**
 * The reference a runtime is given: readable tag, authoritative digest.
 *
 * A stale digest then fails the pull outright instead of quietly starting
 * whatever the tag points at today.
 */
export const referenceFor = (row: {
  image_uri: string;
  image_tag: string;
  image_sha256: string;
}): string => `${row.image_uri}:${row.image_tag}@sha256:${row.image_sha256}`;

/**
 * Everything about one catalog entry, plus the project's GitHub link.
 *
 * One query rather than three: the link is what authorises the image, so
 * reading them apart would leave a window where they disagree.
 */
export const findProjectImage = async (
  projectId: string,
  imageId: string
): Promise<TProjectImageRow | undefined> => {
  const result = await pg.query(
    `SELECT i.image_id, i.image_name, i.description,
            i.image_uri, i.image_tag, i.image_sha256,
            p.github_organization,
            g.installation_id::text AS installation_id
       FROM project_container_images i
       JOIN projects p ON p.project_id = i.project_id
       LEFT JOIN github_app_installations g
              ON g.account_login = p.github_organization
             AND g.revoked_at IS NULL
      WHERE i.project_id = $1 AND i.image_id = $2`,
    [projectId, imageId]
  );
  return result.next()?.allRows()[0] as TProjectImageRow | undefined;
};

/**
 * Resolve a catalog entry into something the broker can pull.
 *
 * Re-checks that the image sits under the project's linked organization even
 * though registration already refused anything else. The rule is cheap to
 * apply and this is the last point before a credential is minted for it — a
 * row that drifted, by a bug or by a link being changed after the fact, stops
 * here rather than being fetched.
 */
export const resolveForBroker = async (
  projectId: string,
  imageId: string,
  config: TGithubAppConfig,
  doFetch: TFetch = fetch
): Promise<{
  imageId: string;
  reference: string;
  pull_token: string;
  github_organization: string;
}> => {
  const row = await findProjectImage(projectId, imageId);
  if (!row) {
    throw new UnknownProjectImage(
      `image ${imageId} is not in the catalog for project ${projectId}`
    );
  }

  const organization = row.github_organization?.toLowerCase();
  if (!organization) {
    throw new NoGithubLink(
      `project ${projectId} is not linked to a GitHub organization`
    );
  }
  if (!row.image_uri.toLowerCase().startsWith(`ghcr.io/${organization}/`)) {
    throw new ProjectImageError(
      `image ${imageId} is outside ghcr.io/${organization}/`
    );
  }
  if (!row.installation_id) {
    throw new NoGithubLink(
      `no active GitHub App installation for ${organization}`
    );
  }

  const repository = ghcrRepository(row.image_uri);
  const installation = await installationToken(
    config,
    row.installation_id,
    doFetch
  );
  const pullToken = await ghcrPullToken(
    installation.token,
    repository,
    doFetch
  );

  return {
    imageId: row.image_id,
    reference: referenceFor(row),
    pull_token: pullToken,
    github_organization: organization,
  };
};

/**
 * Register an image in a project's catalog.
 *
 * The caller supplies a tag; the digest is resolved here. Demanding a digest
 * from the user would buy nothing — GHCR answers it with one HEAD request —
 * and would push a mechanical lookup onto a person.
 */
export const registerProjectImage = async (
  projectId: string,
  input: {
    imageId: string;
    imageName: string;
    description?: string;
    imageUri: string;
    imageTag: string;
  },
  createdBy: string | null,
  config: TGithubAppConfig,
  doFetch: TFetch = fetch
): Promise<{ imageId: string; reference: string }> => {
  const result = await pg.query(
    `SELECT p.github_organization, g.installation_id::text AS installation_id
       FROM projects p
       LEFT JOIN github_app_installations g
              ON g.account_login = p.github_organization
             AND g.revoked_at IS NULL
      WHERE p.project_id = $1`,
    [projectId]
  );

  const project = result.next()?.allRows()[0] as
    | { github_organization: string | null; installation_id: string | null }
    | undefined;
  if (!project) {
    throw new UnknownProjectImage(`project ${projectId} does not exist`);
  }

  const organization = project.github_organization?.toLowerCase();
  if (!organization || !project.installation_id) {
    throw new NoGithubLink(
      `project ${projectId} has no GitHub App installation; connect one before adding images`
    );
  }

  // The allowlist, applied before anything is fetched: a project may only name
  // images under the organization it is linked to. Without this it could
  // register someone else's repository and have the platform pull it on its
  // behalf, using a token minted for the wrong reason.
  if (!input.imageUri.toLowerCase().startsWith(`ghcr.io/${organization}/`)) {
    throw new ProjectImageError(
      `image must live under ghcr.io/${organization}/, got ${input.imageUri}`
    );
  }

  const repository = ghcrRepository(input.imageUri);
  const installation = await installationToken(
    config,
    project.installation_id,
    doFetch
  );
  const pullToken = await ghcrPullToken(
    installation.token,
    repository,
    doFetch
  );
  const digest = await resolveDigest(
    pullToken,
    repository,
    input.imageTag,
    doFetch
  );

  await pg.query(
    `INSERT INTO project_container_images
        (project_id, image_id, image_name, description,
         image_uri, image_tag, image_sha256, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id, image_id) DO UPDATE
        SET image_name = EXCLUDED.image_name,
            description = EXCLUDED.description,
            image_uri = EXCLUDED.image_uri,
            image_tag = EXCLUDED.image_tag,
            image_sha256 = EXCLUDED.image_sha256`,
    [
      projectId,
      input.imageId,
      input.imageName,
      input.description ?? null,
      input.imageUri.toLowerCase(),
      input.imageTag,
      digest,
      createdBy,
    ]
  );

  return {
    imageId: input.imageId,
    reference: referenceFor({
      image_uri: input.imageUri.toLowerCase(),
      image_tag: input.imageTag,
      image_sha256: digest,
    }),
  };
};

export { GithubAppError };
