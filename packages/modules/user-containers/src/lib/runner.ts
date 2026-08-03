import { TJsonObject } from '@holistix-forge/simple-types';
import { TUserContainer } from './servers-types';
import { ContainerImageRegistry } from './image-registry';

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
};

/**
 * Abstract base class for container runners.
 * Provides command generation and container startup functionality.
 */
export abstract class ContainerRunner {
  /**
   * Generate Docker run command for a container.
   */
  generateCommand(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): string {
    const imageDef = imageRegistry.get(container.image_id);
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
    const fullname = `holistix_${safeName}_${shortUuid}`;

    // Build --add-host entries for dev environments
    // In dev, containers can't resolve .local domains via DNS, so we map them
    // to the Docker bridge gateway IP which routes to the host/dev container
    let addHostFlags = '';
    if (process.env.GATEWAY_DEV === '1') {
      // Docker-host address. Defaults to the Linux docker0 bridge gateway
      // (172.17.0.1). On Docker Desktop (macOS/Windows) that IP does not reach
      // the host, so allow overriding via DOCKER_HOST_IP=host.docker.internal.
      const hostIp = process.env.DOCKER_HOST_IP || '172.17.0.1';
      addHostFlags = `--add-host=${config.gateway_fqdn}:${hostIp} --add-host=${config.ganymede_fqdn}:${hostIp} `;
    }

    // Return Docker run command
    return `docker run ${addHostFlags}--restart unless-stopped --name ${fullname} -e SETTINGS=${env} --cap-add=NET_ADMIN --device /dev/net/tun ${imageDef.imageUri}:${imageDef.imageTag}`;
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
