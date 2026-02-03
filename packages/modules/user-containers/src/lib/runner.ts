import { TJsonObject } from '@holistix-forge/simple-types';
import { TUserContainer } from './servers-types';
import { ContainerImageRegistry } from './image-registry';

export type TRunnerConfig = {
  user_id: string;
  project_id: string;
  frontend_fqdn: string;
  ganymede_fqdn: string;
  gateway_fqdn: string;
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

    // Build OAuth clients object
    const oauth_clients: {
      [k: string]: { client_id: string; client_secret?: string };
    } = {};
    container.oauth.forEach((oc) => {
      oauth_clients[oc.service_name] = {
        client_id: oc.client_id,
      };
    });

    // Create settings JSON
    const settings = {
      user_id: config.user_id,
      frontend_fqdn: config.frontend_fqdn,
      ganymede_fqdn: config.ganymede_fqdn,
      gateway_fqdn: config.gateway_fqdn,
      token: jwtToken,
      project_id: config.project_id,
      user_container_id: container.user_container_id,
      oauth_clients,
    };

    // Base64 encode settings
    const json = JSON.stringify(settings);
    const env = Buffer.from(json).toString('base64');

    // Generate container name (sanitize: replace spaces with underscores)
    const shortUuid = container.user_container_id.substring(0, 8);
    const safeName = container.container_name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fullname = `holistix_${safeName}_${shortUuid}`;

    // Return Docker run command
    return `docker run --restart unless-stopped --name ${fullname} -e SETTINGS=${env} --cap-add=NET_ADMIN --device /dev/net/tun ${imageDef.imageUri}:${imageDef.imageTag}`;
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
