import { TokenManager as AbstractTokenManager } from '@holistix-forge/gateway';
import { TJson } from '@holistix-forge/simple-types';
import { EPriority, log } from '@holistix-forge/log';
import { GanymedeClient, createGanymedeClient } from '../lib/ganymede-client';

/**
 * TokenManager - Centralized Token Generation via Ganymede
 *
 * Responsibilities:
 * - Request JWT tokens from Ganymede (the only service with the private key)
 * - Gateway does NOT sign tokens locally - all signing happens in Ganymede
 *
 * Used by modules that need token generation (e.g., user-containers module)
 */
export class TokenManager extends AbstractTokenManager {
  private ganymedeClient: GanymedeClient | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the TokenManager with organization context
   * Must be called after organization token is available
   *
   * @param organizationToken - Organization token for authenticating with Ganymede
   */
  initialize(organizationToken: string): void {
    this.ganymedeClient = createGanymedeClient(organizationToken);
    log(
      EPriority.Info,
      'TOKEN_MANAGER',
      'Initialized with Ganymede client for token generation'
    );
  }

  /**
   * Generate a project-scoped JWT token via Ganymede
   *
   * Tokens are signed by Ganymede (the only service with the private key).
   * TokenManager is a dumb pipe - caller constructs the complete payload.
   * Ganymede only validates project ownership and signs as-is.
   *
   * @param project_id - Project ID the token is scoped to
   * @param payload - Complete token payload (type, scope, claims, etc.)
   * @returns Promise resolving to signed JWT token string
   */
  async generateProjectScopedToken(
    project_id: string,
    payload: TJson
  ): Promise<string> {
    if (!this.ganymedeClient) {
      throw new Error(
        'TokenManager not initialized. Call initialize() with organization token first.'
      );
    }

    const payloadType =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).type
        : 'unknown';

    log(
      EPriority.Info,
      'TOKEN_MANAGER',
      `Requesting token for project ${project_id}`,
      { type: payloadType }
    );

    const response = await this.ganymedeClient.request<{ token: string }>({
      method: 'POST',
      url: '/gateway/tokens/scoped',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        project_id,
        payload,
      } as TJson,
    });

    log(
      EPriority.Info,
      'TOKEN_MANAGER',
      `Generated token for project ${project_id}`
    );

    return response.token;
  }
}
