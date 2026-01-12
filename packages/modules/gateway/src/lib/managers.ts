/**
 * Manager Interfaces for Gateway Module
 *
 * All manager interfaces that need to be exposed to other modules
 * must be defined here. This ensures other modules never have to
 * import from app-gateway (which is not possible).
 */

import { TJson } from '@holistix-forge/simple-types';
import type {
  TStoredCredential,
  TCredentialSummary,
  TDecryptedCredential,
} from './credential-provider-types';

/**
 * Abstract TokenManager interface
 * Provides generic token generation for JWT
 */
export abstract class TokenManager {
  /**
   * Generate JWT token for any payload
   * @param payload - Payload object to encode
   * @param expiresIn - Optional expiration (default: '1h')
   * @returns JWT token string
   */
  abstract generateJWTToken(payload: TJson, expiresIn?: string): string;
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

// =============================================================================
// CREDENTIAL MANAGER
// =============================================================================

/**
 * Create API Key credential request
 */
export type TCreateApiKeyCredentialRequest = {
  provider_id: string;
  name: string;
  /** Field values keyed by field name */
  values: Record<string, string>;
  metadata?: Record<string, unknown>;
};

/**
 * OAuth state for credential creation (stored during OAuth flow)
 */
export type TOAuthCredentialState = {
  state: string;
  provider_id: string;
  name: string;
  user_id: string;
  redirect_uri: string;
  pkce_verifier?: string;
  created_at: string;
  expires_at: string;
};

/**
 * Abstract CredentialManager interface
 * Provides credential management methods needed by gateway routes
 */
export abstract class CredentialManager {
  // ==========================================================================
  // CREDENTIAL STORAGE (encrypted)
  // ==========================================================================

  /**
   * Store API key credential
   * @param user_id - User who owns this credential
   * @param request - Credential creation request
   * @returns Created credential summary
   */
  abstract createApiKeyCredential(
    user_id: string,
    request: TCreateApiKeyCredentialRequest
  ): Promise<TCredentialSummary>;

  /**
   * Store OAuth credential (called after OAuth callback)
   * @param user_id - User who owns this credential
   * @param provider_id - Provider ID
   * @param name - User-given name
   * @param tokens - OAuth tokens to store
   * @returns Created credential summary
   */
  abstract createOAuthCredential(
    user_id: string,
    provider_id: string,
    name: string,
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
    }
  ): Promise<TCredentialSummary>;

  /**
   * Get credential by ID
   */
  abstract getCredential(
    credential_id: string
  ): Promise<TStoredCredential | null>;

  /**
   * Get credential summary by ID (no sensitive data)
   */
  abstract getCredentialSummary(
    credential_id: string
  ): Promise<TCredentialSummary | null>;

  /**
   * List user's credentials (summaries only)
   */
  abstract listCredentials(user_id: string): Promise<TCredentialSummary[]>;

  /**
   * Update credential metadata/name
   */
  abstract updateCredential(
    credential_id: string,
    updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      is_active?: boolean;
    }
  ): Promise<TCredentialSummary | null>;

  /**
   * Delete credential
   */
  abstract deleteCredential(credential_id: string): Promise<boolean>;

  // ==========================================================================
  // CREDENTIAL USAGE (decrypted)
  // ==========================================================================

  /**
   * Get decrypted credential for use
   * This should only be called server-side, never returned to frontend
   * Also updates last_used_at timestamp
   */
  abstract useCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null>;

  /**
   * Refresh OAuth credential if expired
   * Returns updated credential or null if refresh fails
   */
  abstract refreshOAuthCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null>;

  // ==========================================================================
  // OAUTH FLOW STATE
  // ==========================================================================

  /**
   * Save OAuth state for credential creation
   */
  abstract saveOAuthState(state: TOAuthCredentialState): void;

  /**
   * Get and delete OAuth state
   */
  abstract consumeOAuthState(state: string): TOAuthCredentialState | null;

  /**
   * Cleanup expired OAuth states
   */
  abstract cleanupExpiredOAuthStates(): void;
}
