/**
 * Manager Interfaces for Gateway Module
 *
 * All manager interfaces that need to be exposed to other modules
 * must be defined here. This ensures other modules never have to
 * import from app-gateway (which is not possible).
 */

import { TJson } from '@holistix-forge/simple-types';

/**
 * Abstract TokenManager interface
 * Provides token generation via Ganymede (centralized signing)
 */
export abstract class TokenManager {
  /**
   * Generate a project-scoped JWT token via Ganymede
   *
   * Tokens are signed by Ganymede (the only service with the private key).
   * TokenManager is a dumb pipe - caller constructs the complete payload.
   * Ganymede only validates project ownership and signs as-is.
   *
   * @param project_id - Project ID the token is scoped to
   * @param payload - Complete token payload (type, scope, claims - caller defines structure)
   * @returns Promise resolving to signed JWT token string
   */
  abstract generateProjectScopedToken(
    project_id: string,
    payload: TJson
  ): Promise<string>;
}

/**
 * Abstract PermissionManager interface
 * Provides permission management methods needed by other modules
 */
export abstract class PermissionManager {
  /**
   * Check if user has exact permission
   * Simple exact-match only (no hierarchy for now)
   */
  abstract hasPermission(user_id: string, permission: string): boolean;

  /**
   * Add permission to user
   */
  abstract addPermission(user_id: string, permission: string): void;

  /**
   * Remove permission from user
   */
  abstract removePermission(user_id: string, permission: string): void;
}
