import { TContainerImageDefinition } from './container-image';

export const GHCR_HOST = 'ghcr.io';

/**
 * The owner segment of a GHCR reference, lowercased.
 *
 * `ghcr.io/acme/etl` → `acme`. Undefined for anything that is not a GHCR
 * reference. GHCR lowercases the owner in image paths, so comparing anything
 * else would leave `Acme` and `acme` as two separate allowlists.
 */
export const ghcrOwner = (imageUri: string): string | undefined => {
  const [host, owner] = imageUri.split('/');
  if (host !== GHCR_HOST || !owner) return undefined;
  return owner.toLowerCase();
};

/**
 * Catalogue of images a container may be started from.
 *
 * Two tiers, deliberately kept apart:
 *
 * - **Built-in** images are registered in code by feature modules (jupyter,
 *   n8n, pgadmin4, …). Every project sees them.
 * - **Project** images are supplied by a tenant. They are visible only to the
 *   project that registered them.
 *
 * The separation is what keeps `image_id` usable as an allowlist key. A runner
 * is handed an id and resolves it here; it never receives an image URI from the
 * caller. Once tenants can add images, that property is the only thing standing
 * between "pick a service from a list" and "run any image on the platform".
 *
 * Scoped by project rather than by organization because that is where the pull
 * credential lives: `credential_shares` carries `share_scope = 'project'`, so
 * an image and the token that fetches it belong to the same thing. It is also
 * the stricter of the two — it stops a leak between projects of one
 * organization, not merely between organizations.
 */
export class ContainerImageRegistry {
  private readonly builtin: Map<string, TContainerImageDefinition> = new Map();

  private readonly byProject: Map<
    string,
    Map<string, TContainerImageDefinition>
  > = new Map();

  /**
   * Register built-in images, visible to every project.
   */
  register(images: TContainerImageDefinition[]): void {
    images.forEach((img) => {
      if (this.builtin.has(img.imageId)) {
        throw new Error(`Image ${img.imageId} already registered`);
      }
      this.builtin.set(img.imageId, img);
    });
  }

  /**
   * Register images supplied by a project.
   *
   * `githubOrganization` is the GitHub organization the project is linked to,
   * and is required — a project with no link may run built-in images only.
   *
   * Three rules, all load-bearing:
   *
   * - The image must live under `ghcr.io/<githubOrganization>/`. This is the
   *   allowlist, and it is a string comparison: it holds before any network
   *   call, so a registry that answers differently than expected cannot get
   *   around it. Without it a project could register `ghcr.io/someoneElse/…`
   *   and, if its token happened to have access, the platform would fetch it
   *   on the project's behalf.
   * - A built-in id cannot be taken over. Otherwise a project could register
   *   its own `jupyter:minimal`, and a user picking JupyterLab from the
   *   catalogue would silently run someone else's image.
   * - A digest is mandatory. A tenant image referenced by mutable tag is not
   *   the same artifact from one start to the next, and on shared
   *   infrastructure that is the difference between a review and a promise.
   */
  registerForProject(
    projectId: string,
    githubOrganization: string,
    images: TContainerImageDefinition[]
  ): void {
    if (!projectId) {
      throw new Error('projectId is required to register images');
    }
    if (!githubOrganization) {
      throw new Error(
        `Project ${projectId} is not linked to a GitHub organization and may only run built-in images`
      );
    }

    const expectedOwner = githubOrganization.toLowerCase();
    const scoped = this.byProject.get(projectId) ?? new Map();

    images.forEach((img) => {
      const owner = ghcrOwner(img.imageUri);
      if (owner !== expectedOwner) {
        throw new Error(
          `Image ${img.imageId} must live under ${GHCR_HOST}/${expectedOwner}/, got ${img.imageUri}`
        );
      }
      if (this.builtin.has(img.imageId)) {
        throw new Error(
          `Image ${img.imageId} is a built-in image and cannot be overridden`
        );
      }
      if (!img.imageSha256) {
        throw new Error(
          `Image ${img.imageId} must be pinned by digest (imageSha256)`
        );
      }
      if (scoped.has(img.imageId)) {
        throw new Error(
          `Image ${img.imageId} already registered for project ${projectId}`
        );
      }
      scoped.set(img.imageId, img);
    });

    this.byProject.set(projectId, scoped);
  }

  /**
   * Catalogues that are scoped by the same project and have to go at the same
   * time — the stack catalogue is one, and any later one will be too.
   */
  private readonly dependents: ((projectId: string) => void)[] = [];

  /**
   * Be cleared whenever this registry is.
   *
   * A second catalogue keyed by project is a second thing to forget. Making it
   * this registry's business rather than the caller's means whoever wires
   * clearing on reallocation wires it once and cannot get it half right —
   * which is the failure mode that matters here, because a catalogue that
   * outlives its tenant is a cross-tenant leak and not merely stale data.
   */
  onProjectCleared(listener: (projectId: string) => void): void {
    this.dependents.push(listener);
  }

  /**
   * Drop everything a project registered, here and in every catalogue that
   * hangs off this one.
   *
   * Gateway pool containers are reallocated between organizations, so a process
   * that keeps serving the previous tenant's catalogue is a cross-tenant leak
   * rather than merely stale data.
   *
   * Nothing calls this yet. `registerForProject` has no caller either — the
   * per-project tier is written and not wired — so there is no leak today, only
   * one waiting for the day the two halves are connected. Tracked in Linear.
   */
  clearProject(projectId: string): void {
    this.byProject.delete(projectId);
    this.dependents.forEach((clear) => clear(projectId));
  }

  /**
   * Resolve an image id.
   *
   * Built-in images are checked first — see `registerForProject` for why
   * shadowing them must not be possible. Without a `projectId` only built-in
   * images resolve.
   */
  get(
    imageId: string,
    projectId?: string
  ): TContainerImageDefinition | undefined {
    const builtin = this.builtin.get(imageId);
    if (builtin) return builtin;
    if (!projectId) return undefined;
    return this.byProject.get(projectId)?.get(imageId);
  }

  /**
   * Whether this id names one of the platform's own images.
   *
   * The distinction decides whether a reference has to be digest-pinned. A
   * built-in comes from this deployment's own list and changes when the
   * platform is redeployed, not when a tenant pushes; a tenant image is
   * required to carry `imageSha256` at registration, above. The broker has
   * drawn the same line since it was written — `catalogue.ts`, `!builtin &&
   * !DIGEST_PINNED` — and this is how the other half of the platform can ask
   * the same question.
   *
   * Not derived from the reference: an unpinned reference and a built-in are
   * the same string today, and reading trust out of a shape rather than out of
   * the catalogue is how the two would drift apart.
   */
  isBuiltin(imageId: string): boolean {
    return this.builtin.has(imageId);
  }

  /**
   * Every image a project may start. Without a `projectId` this is the built-in
   * catalogue alone — never another tenant's images.
   */
  getAll(projectId?: string): TContainerImageDefinition[] {
    const all = Array.from(this.builtin.values());
    if (!projectId) return all;
    const scoped = this.byProject.get(projectId);
    return scoped ? [...all, ...scoped.values()] : all;
  }
}

/**
 * The image reference a container runtime should be given.
 *
 * `name:tag@sha256:digest` when a digest is recorded, rather than either alone.
 * The runtime resolves by digest and the tag stays readable for humans; a
 * digest that no longer matches fails the pull outright instead of quietly
 * starting whatever the tag points at today.
 *
 * Note this is the first code to read `imageSha256`. The field has been on
 * `TContainerImageDefinition` from the start and jupyter has been filling it,
 * but nothing consumed it — every container so far started from a mutable tag.
 */
export const imageReference = (image: TContainerImageDefinition): string => {
  if (!image.imageSha256) {
    return `${image.imageUri}:${image.imageTag}`;
  }
  const digest = image.imageSha256.replace(/^sha256:/, '');
  return `${image.imageUri}:${image.imageTag}@sha256:${digest}`;
};
