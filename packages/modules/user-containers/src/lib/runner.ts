import { TJsonObject } from '@holistix-forge/simple-types';
import { TUserContainer } from './servers-types';
import { ContainerImageRegistry, imageReference } from './image-registry';

export type TRunnerConfig = {
  user_id: string;
  project_id: string;
  frontend_fqdn: string;
  ganymede_fqdn: string;
  gateway_fqdn: string;
  organization_id: string;
  /**
   * Secret for `container.auth_guard.client_id`.
   *
   * Passed alongside the container rather than on it: the container record
   * lives in collab shared state and is replicated to every client in the
   * project, so the secret must never be stored there.
   */
  auth_guard_client_secret?: string;
  /**
   * Local development only: hosts to map, because `.local` names do not
   * resolve inside a container.
   *
   * Supplied by the caller rather than read from `process.env` here — module
   * packages are bundled with a browser `process` shim, so this file's
   * environment is empty at runtime in the gateway and the mapping was never
   * actually emitted.
   */
  dev_host_ip?: string;
};

/**
 * Caps a container runs under.
 *
 * Meaningless when the container runs on the user's own machine — it is their
 * CPU and their memory. On shared infrastructure they are mandatory, and a
 * microVM needs a fixed memory figure at boot rather than a ceiling it may
 * grow into.
 */
export type TContainerLimits = {
  cpus: number;
  memoryMb: number;
  pidsLimit: number;
};

export const DEFAULT_CONTAINER_LIMITS: TContainerLimits = {
  cpus: 2,
  memoryMb: 2048,
  pidsLimit: 512,
};

/**
 * Everything needed to start one container, resolved and validated.
 *
 * This is what a runner receives — never a command line, and never an image
 * URI chosen by the caller. `imageRef` has already been resolved from an
 * `image_id` against the registry, which is what makes the id an allowlist key
 * rather than a suggestion.
 */
export type TContainerLaunchSpec = {
  name: string;
  /**
   * The catalogue key, carried alongside the resolved reference.
   *
   * The platform runner sends this rather than `imageRef`: the broker
   * re-resolves it host-side, so a gateway cannot name an arbitrary image. The
   * local runner has no such boundary to defend — the command it emits runs on
   * the user's own machine — and uses `imageRef` directly.
   */
  imageId: string;
  imageRef: string;
  /** Base64 `SETTINGS` blob, the container's entire configuration channel. */
  settings: string;
  capabilities: string[];
  /**
   * Host devices to pass through.
   *
   * Empty under a microVM runtime: the guest has its own kernel, so tun comes
   * from the guest image rather than from the host's `/dev/net/tun`.
   */
  devices: string[];
  /** Extra host mappings, dev environments only. */
  extraHosts: { host: string; ip: string }[];
  limits: TContainerLimits;
};

/**
 * Abstract base class for container runners.
 * Provides command generation and container startup functionality.
 */
export abstract class ContainerRunner {
  /**
   * Resolve a container into the spec a runtime can start it from.
   */
  buildLaunchSpec(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig,
    limits: TContainerLimits = DEFAULT_CONTAINER_LIMITS
  ): TContainerLaunchSpec {
    // Scoped by project: that is where the pull credential lives, so the image
    // and the token that fetches it are resolved against the same thing.
    const imageDef = imageRegistry.get(container.image_id, config.project_id);
    if (!imageDef) {
      throw new Error(`Image ${container.image_id} not found in registry`);
    }

    // Create settings JSON
    const settings = {
      user_id: config.user_id,
      frontend_fqdn: config.frontend_fqdn,
      ganymede_fqdn: config.ganymede_fqdn,
      gateway_fqdn: config.gateway_fqdn,
      token: jwtToken,
      project_id: config.project_id,
      user_container_id: container.user_container_id,
      // Auth Guard Proxy config (per-container OAuth client registered with
      // Ganymede). The secret comes from the config, not the container: it is
      // never persisted in shared state.
      ...(container.auth_guard &&
        config.auth_guard_client_secret && {
          auth_guard: {
            client_id: container.auth_guard.client_id,
            client_secret: config.auth_guard_client_secret,
            container_id: container.user_container_id,
            organization_id: config.organization_id,
          },
        }),
    };

    // Base64 encode settings
    const json = JSON.stringify(settings);
    const env = Buffer.from(json).toString('base64');

    // Generate container name (sanitize: replace spaces with underscores)
    const shortUuid = container.user_container_id.substring(0, 8);
    const safeName = container.container_name.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Build --add-host entries for dev environments
    // In dev, containers can't resolve .local domains via DNS, so we map them
    // to the Docker bridge gateway IP which routes to the host/dev container
    const extraHosts: { host: string; ip: string }[] = [];
    if (config.dev_host_ip) {
      extraHosts.push(
        { host: config.gateway_fqdn, ip: config.dev_host_ip },
        { host: config.ganymede_fqdn, ip: config.dev_host_ip }
      );
    }

    return {
      name: `holistix_${safeName}_${shortUuid}`,
      imageId: imageDef.imageId,
      imageRef: imageReference(imageDef),
      settings: env,
      // The container runs an OpenVPN client to reach its gateway.
      capabilities: ['NET_ADMIN'],
      devices: ['/dev/net/tun'],
      extraHosts,
      limits,
    };
  }

  /**
   * Generate Docker run command for a container.
   */
  generateCommand(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): string {
    const spec = this.buildLaunchSpec(
      container,
      jwtToken,
      imageRegistry,
      config
    );

    const addHostFlags = spec.extraHosts
      .map((h) => `--add-host=${h.host}:${h.ip} `)
      .join('');
    const capFlags = spec.capabilities.map((c) => `--cap-add=${c} `).join('');
    const deviceFlags = spec.devices.map((d) => `--device ${d} `).join('');

    // Return Docker run command
    return (
      `docker run ${addHostFlags}--restart unless-stopped --name ${spec.name} ` +
      `-e SETTINGS=${spec.settings} ${capFlags}${deviceFlags}${spec.imageRef}`
    );
  }

  /**
   * Start a container.
   * Returns runner-specific data to be merged into container.runner in shared state.
   */
  abstract start(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): Promise<TJsonObject>;
}
