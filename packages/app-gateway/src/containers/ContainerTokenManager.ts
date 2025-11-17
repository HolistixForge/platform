import { log } from '@monorepo/log';
import { makeHmacToken } from '@monorepo/backend-engine';
import { IPersistenceProvider } from '../state/IPersistenceProvider';
import type { TContainerTokenData } from './types';

/**
 * ContainerTokenManager - HMAC Token Management for Containers
 *
 * Responsibilities:
 * - Generate HMAC tokens for containers (container ↔ gateway auth)
 * - Validate container tokens
 * - Store tokens internally (persisted via IPersistenceProvider)
 * - Clean up tokens when containers are destroyed
 * - Provide persistence via IPersistenceProvider interface
 *
 * Token Format: HMAC-SHA256 based on:
 * - container_id
 * - project_id
 * - secret (from env: GATEWAY_HMAC_SECRET)
 * - timestamp
 */
export class ContainerTokenManager implements IPersistenceProvider {
  private secret: string;
  private data: TContainerTokenData;

  constructor(secret?: string) {
    this.secret =
      secret || process.env.GATEWAY_HMAC_SECRET || 'default-secret-change-me';
    if (this.secret === 'default-secret-change-me') {
      log(
        3,
        'CONTAINER_TOKEN',
        'WARNING: Using default HMAC secret! Set GATEWAY_HMAC_SECRET env var!'
      );
    }

    this.data = {
      container_tokens: {},
    };
  }

  // IPersistenceProvider implementation

  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    if (!data) {
      log(6, 'CONTAINER_TOKEN', 'No container token data to load');
      return;
    }

    if (data.container_tokens && typeof data.container_tokens === 'object') {
      this.data.container_tokens =
        data.container_tokens as TContainerTokenData['container_tokens'];
      log(6, 'CONTAINER_TOKEN', 'Loaded container token data');
    } else {
      log(5, 'CONTAINER_TOKEN', 'Invalid container token data format');
    }
  }

  saveToSerializable(): Record<string, unknown> {
    return {
      container_tokens: { ...this.data.container_tokens },
    };
  }

  // Token management methods

  /**
   * Generate HMAC token for a container
   */
  generateToken(container_id: string, project_id: string): string {
    const payload = `${container_id}:${project_id}:${Date.now()}`;
    const token = makeHmacToken(payload, this.secret);

    // Store token
    this.data.container_tokens[container_id] = {
      token,
      project_id,
      created_at: new Date().toISOString(),
    };

    log(7, 'CONTAINER_TOKEN', `Generated token for container: ${container_id}`);
    return token;
  }

  /**
   * Validate a container token
   * Returns container_id and project_id if valid, null if invalid
   */
  validateToken(
    token: string
  ): { container_id: string; project_id: string } | null {
    // Find container by token
    for (const [container_id, containerToken] of Object.entries(
      this.data.container_tokens
    )) {
      if (containerToken.token === token) {
        log(
          7,
          'CONTAINER_TOKEN',
          `Token validated for container: ${container_id}`
        );
        return {
          container_id,
          project_id: containerToken.project_id,
        };
      }
    }

    log(5, 'CONTAINER_TOKEN', 'Invalid token provided');
    return null;
  }

  /**
   * Get token for a container (if exists)
   */
  getToken(container_id: string): string | null {
    const containerToken = this.data.container_tokens[container_id];
    return containerToken ? containerToken.token : null;
  }

  /**
   * Revoke/delete token for a container
   */
  revokeToken(container_id: string): void {
    delete this.data.container_tokens[container_id];
    log(7, 'CONTAINER_TOKEN', `Revoked token for container: ${container_id}`);
  }

  /**
   * List all container tokens (for a project or all)
   */
  listTokens(project_id?: string): Array<{
    container_id: string;
    project_id: string;
    created_at: string;
  }> {
    const tokens = Object.entries(this.data.container_tokens).map(
      ([container_id, token]) => ({
        container_id,
        project_id: token.project_id,
        created_at: token.created_at,
      })
    );

    if (project_id) {
      return tokens.filter((t) => t.project_id === project_id);
    }

    return tokens;
  }

  /**
   * Cleanup tokens for a specific project (when project is deleted)
   */
  cleanupProject(project_id: string): void {
    const toDelete = Object.entries(this.data.container_tokens)
      .filter(([, token]) => token.project_id === project_id)
      .map(([container_id]) => container_id);

    for (const container_id of toDelete) {
      delete this.data.container_tokens[container_id];
    }

    if (toDelete.length > 0) {
      log(
        6,
        'CONTAINER_TOKEN',
        `Cleaned up ${toDelete.length} container tokens for project: ${project_id}`
      );
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: Object.keys(this.data.container_tokens).length,
    };
  }
}
