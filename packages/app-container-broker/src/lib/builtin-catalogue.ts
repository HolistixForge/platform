import { TCatalogueSource } from './catalogue';
import { TResolvedImage } from './types';

/**
 * Images the platform ships, resolvable without asking Ganymede.
 *
 * These are ours: public, carrying no tenant credential, and identical for
 * every project. They live in the gateway's in-memory registry, which the
 * broker deliberately cannot see — so without this list a built-in image is
 * unresolvable and the platform runner can only ever start tenant images.
 *
 * It is still an allowlist. The gateway names an id; what that id means is
 * decided here, on the platform host.
 *
 * **Keep in sync with the module definitions.** Each entry mirrors one
 * `imageRegistry.register(...)` call:
 *
 *   ubuntu:terminal   packages/modules/user-containers/src/index.ts
 *   jupyter:*         packages/modules/jupyter/src/index.ts
 *   n8n:latest        packages/modules/n8n/src/backend.ts
 *   pgadmin:latest    packages/modules/pgadmin4/src/backend.ts
 *   vscode:latest     packages/modules/vscode/src/index.ts
 *
 * The duplication is deliberate rather than accidental: the broker must not
 * import module code, because the point of it is to decide independently of
 * the process that asks. A drift here fails closed — an unknown id is refused,
 * never guessed at.
 */
export const BUILTIN_IMAGES: Record<string, string> = {
  'ubuntu:terminal': 'holistixforge/ubuntu-terminal:24.04',
  'jupyter:minimal': 'holistixforge/jupyterlab-minimal:lab-4.2.0',
  'jupyter:pytorch': 'holistixforge/jupyterlab-pytorch:lab-4.2.0',
  'n8n:latest': 'holistixforge/n8n:1.97.1',
  'pgadmin:latest': 'holistixforge/pgadmin4:8.12.0',
  'vscode:latest': 'holistixforge/vscode-server:latest',
};

/**
 * Try the built-in list first, then fall through to the project catalogue.
 *
 * Built-ins are checked first for the same reason a project may not shadow one:
 * a tenant entry that took over `jupyter:minimal` would silently replace the
 * image a user thought they were picking.
 */
export const withBuiltins =
  (projectCatalogue: TCatalogueSource): TCatalogueSource =>
  async (projectId, imageId): Promise<TResolvedImage | undefined> => {
    const builtin = BUILTIN_IMAGES[imageId];
    if (builtin) {
      // No pull token and no organization: ours, and public.
      return { imageId, reference: builtin, builtin: true };
    }
    return projectCatalogue(projectId, imageId);
  };
