import { TContainerImageDefinition } from './container-image';

/**
 * Catalogue of images a container may be started from.
 *
 * Two tiers, deliberately kept apart:
 *
 * - **Built-in** images are registered in code by feature modules (jupyter,
 *   n8n, pgadmin4, …). Every organization sees them.
 * - **Organization** images are supplied by a tenant. They are visible only to
 *   the organization that registered them.
 *
 * The separation is what keeps `image_id` usable as an allowlist key. A runner
 * is handed an id and resolves it here; it never receives an image URI from the
 * caller. Once tenants can add images, that property is the only thing standing
 * between "pick a service from a list" and "run any image on the platform".
 */
export class ContainerImageRegistry {
  private readonly builtin: Map<string, TContainerImageDefinition> = new Map();

  private readonly byOrganization: Map<
    string,
    Map<string, TContainerImageDefinition>
  > = new Map();

  /**
   * Register built-in images, visible to every organization.
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
   * Register images supplied by an organization.
   *
   * Two rules, both load-bearing:
   *
   * - A built-in id cannot be taken over. Otherwise an organization could
   *   register its own `jupyter:minimal`, and a user picking JupyterLab from
   *   the catalogue would silently run someone else's image.
   * - A digest is mandatory. A tenant image referenced by mutable tag is not
   *   the same artifact from one start to the next, and on shared
   *   infrastructure that is the difference between a review and a promise.
   */
  registerForOrganization(
    organizationId: string,
    images: TContainerImageDefinition[]
  ): void {
    if (!organizationId) {
      throw new Error('organizationId is required to register images');
    }

    const scoped = this.byOrganization.get(organizationId) ?? new Map();

    images.forEach((img) => {
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
          `Image ${img.imageId} already registered for organization ${organizationId}`
        );
      }
      scoped.set(img.imageId, img);
    });

    this.byOrganization.set(organizationId, scoped);
  }

  /**
   * Drop everything an organization registered.
   *
   * Gateway pool containers are reallocated between organizations, so a process
   * that keeps serving the previous tenant's catalogue is a cross-tenant leak
   * rather than merely stale data.
   */
  clearOrganization(organizationId: string): void {
    this.byOrganization.delete(organizationId);
  }

  /**
   * Resolve an image id.
   *
   * Built-in images are checked first — see `registerForOrganization` for why
   * shadowing them must not be possible. Without an `organizationId` only
   * built-in images resolve.
   */
  get(
    imageId: string,
    organizationId?: string
  ): TContainerImageDefinition | undefined {
    const builtin = this.builtin.get(imageId);
    if (builtin) return builtin;
    if (!organizationId) return undefined;
    return this.byOrganization.get(organizationId)?.get(imageId);
  }

  /**
   * Every image an organization may start. Without an `organizationId` this is
   * the built-in catalogue alone — never another tenant's images.
   */
  getAll(organizationId?: string): TContainerImageDefinition[] {
    const all = Array.from(this.builtin.values());
    if (!organizationId) return all;
    const scoped = this.byOrganization.get(organizationId);
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
