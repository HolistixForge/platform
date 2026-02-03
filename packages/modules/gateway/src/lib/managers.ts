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
 * OAuth Client definition (used by OAuthManager interface)
 */
export interface TOAuthClient {
  client_id: string;
  client_secret: string;
  project_id: string;
  service_name: string;
  redirect_uris: string[];
  grants: string[];
  created_at: string;
}

/**
 * OAuth Authorization Code (used by OAuthManager interface)
 */
export interface TOAuthCode {
  code: string;
  client_id: string;
  user_id: string;
  scope: string[];
  redirect_uri: string;
  expires_at: string;
  created_at: string;
}

/**
 * OAuth Token (used by OAuthManager interface)
 */
export interface TOAuthToken {
  token_id: string;
  client_id: string;
  user_id: string;
  scope: string[];
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  created_at: string;
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

/**
 * Abstract OAuthManager interface
 * Provides OAuth management methods needed by other modules
 */
export abstract class OAuthManager {
  // OAuth Clients

  /**
   * Add OAuth client
   */
  abstract addClient(client: TOAuthClient): void;

  /**
   * Get OAuth client by ID
   */
  abstract getClient(client_id: string): TOAuthClient | null;

  /**
   * Delete OAuth client
   */
  abstract deleteClient(client_id: string): void;

  // Authorization Codes

  /**
   * Save authorization code
   */
  abstract saveCode(code: TOAuthCode): void;

  /**
   * Get authorization code
   */
  abstract getCode(code: string): TOAuthCode | null;

  /**
   * Delete authorization code
   */
  abstract deleteCode(code: string): void;

  // Tokens

  /**
   * Save OAuth token
   */
  abstract saveToken(token: TOAuthToken): void;

  /**
   * Get OAuth token by access token
   */
  abstract getToken(access_token: string): TOAuthToken | null;

  /**
   * Get OAuth token by token ID
   */
  abstract getTokenById(token_id: string): TOAuthToken | null;

  /**
   * Delete OAuth token
   */
  abstract deleteToken(token_id: string): void;
}
