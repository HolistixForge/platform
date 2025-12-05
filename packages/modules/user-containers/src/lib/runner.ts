import { TUserContainer } from './servers-types';
import { ContainerImageRegistry } from './image-registry';

/**
 * Abstract base class for container runners
 * Provides command generation and container startup functionality
 */
export abstract class ContainerRunner {
  /**
   * Generate Docker run command for a container
   * @param container - Container to generate command for
   * @param jwtToken - JWT token for container authentication
   * @param imageRegistry - Image registry to get image definition
   * @param config - Configuration with FQDNs and user info
   * @returns Docker run command string
   */
  generateCommand(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: {
      user_id: string;
      project_id: string;
      frontend_fqdn: string;
      ganymede_fqdn: string;
      gateway_fqdn: string;
    }
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
        // client_secret would need to be retrieved from OAuthManager if needed
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

    // Generate container name
    const shortUuid = container.user_container_id.substring(0, 8);
    const fullname = `holistix_${container.container_name}_${shortUuid}`;

    // Return Docker run command
    return `docker run --restart unless-stopped --name ${fullname} -e SETTINGS=${env} --cap-add=NET_ADMIN --device /dev/net/tun ${imageDef.imageUri}:${imageDef.imageTag}`;
  }

  /**
   * Start a container
   * @param container - Container to start
   * @param jwtToken - JWT token for container authentication
   */
  abstract start(container: TUserContainer, jwtToken: string): Promise<void>;
}
