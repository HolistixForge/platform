/**
 * CredentialManager - Manages credentials for third-party integrations
 *
 * Responsibilities:
 * - Manages the CredentialProviderRegistry (modules register providers here)
 * - Proxies credential CRUD operations to Ganymede API
 * - Handles OAuth flow state (temporary in-memory)
 * - Provides encryption/decryption key management
 *
 * Credentials are stored in Ganymede's database, not in gateway memory,
 * because they are user-owned and need to persist across gateway instances.
 */

import { EPriority, log } from '@holistix-forge/log';
import crypto from 'crypto';
import { TJson } from '@holistix-forge/simple-types';
import {
  CredentialManager as AbstractCredentialManager,
  CredentialProviderRegistry,
  type TCreateApiKeyCredentialRequest,
  type TOAuthCredentialState,
  type TCredentialSummary,
  type TStoredCredential,
  type TDecryptedCredential,
  type TCredentialProvider,
} from '@holistix-forge/gateway';
import type { GanymedeClient } from '../lib/ganymede-client';

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Credential Manager Implementation
 */
export class CredentialManagerImpl extends AbstractCredentialManager {
  private providerRegistry: CredentialProviderRegistry;
  private oauthStates: Map<string, TOAuthCredentialState> = new Map();
  private ganymedeClient: GanymedeClient | null = null;
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    super();
    this.providerRegistry = new CredentialProviderRegistry();
    // Use provided key or generate one (in production, use env var)
    this.encryptionKey =
      encryptionKey || process.env.CREDENTIALS_ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        'No encryption key provided - credentials will not be encrypted properly'
      );
    }
  }

  /**
   * Set the Ganymede client for API calls
   */
  setGanymedeClient(client: GanymedeClient): void {
    this.ganymedeClient = client;
  }

  // ==========================================================================
  // PROVIDER REGISTRY (accessed by modules)
  // ==========================================================================

  /**
   * Get the provider registry for module registration
   */
  getProviderRegistry(): CredentialProviderRegistry {
    return this.providerRegistry;
  }

  /**
   * Get all registered providers
   */
  getProviders(): TCredentialProvider[] {
    return this.providerRegistry.getAll();
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): TCredentialProvider | undefined {
    return this.providerRegistry.get(id);
  }

  // ==========================================================================
  // ENCRYPTION HELPERS
  // ==========================================================================

  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
  }

  private encrypt(plaintext: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.deriveKey(salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  private decrypt(encryptedValue: string): string {
    const combined = Buffer.from(encryptedValue, 'base64');

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );

    const key = this.deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  // ==========================================================================
  // CREDENTIAL STORAGE (via Ganymede API)
  // ==========================================================================

  override async createApiKeyCredential(
    user_id: string,
    request: TCreateApiKeyCredentialRequest
  ): Promise<TCredentialSummary> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    // Validate provider exists
    const provider = this.providerRegistry.get(request.provider_id);
    if (!provider) {
      throw new Error(`Unknown credential provider: ${request.provider_id}`);
    }
    if (provider.collectionMethod !== 'api_key') {
      throw new Error(
        `Provider ${request.provider_id} is not an API key provider`
      );
    }

    // Encrypt the values
    const encryptedValues = this.encrypt(JSON.stringify(request.values));

    log(
      EPriority.Info,
      'CREDENTIALS',
      `Creating API key credential for provider ${request.provider_id}`
    );

    // Call Ganymede API to store
    const result = await this.ganymedeClient.request<{
      credential: TCredentialSummary;
    }>({
      method: 'POST',
      url: '/credentials',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        provider_id: request.provider_id,
        name: request.name,
        collection_method: 'api_key',
        encrypted_values: encryptedValues,
        metadata: request.metadata,
        // These come from provider
        provider_display_name: provider.displayName,
        provider_icon: provider.icon,
      } as TJson,
    });

    return result.credential;
  }

  override async createOAuthCredential(
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
  ): Promise<TCredentialSummary> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    // Validate provider exists
    const provider = this.providerRegistry.get(provider_id);
    if (!provider) {
      throw new Error(`Unknown credential provider: ${provider_id}`);
    }
    if (provider.collectionMethod !== 'oauth') {
      throw new Error(`Provider ${provider_id} is not an OAuth provider`);
    }

    // Encrypt tokens
    const encryptedAccessToken = this.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? this.encrypt(tokens.refresh_token)
      : undefined;

    // Calculate expiration times
    const now = new Date();
    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : undefined;
    const refreshTokenExpiresAt = tokens.refresh_expires_in
      ? new Date(now.getTime() + tokens.refresh_expires_in * 1000).toISOString()
      : undefined;

    log(
      EPriority.Info,
      'CREDENTIALS',
      `Creating OAuth credential for provider ${provider_id}`
    );

    // Call Ganymede API to store
    const result = await this.ganymedeClient.request<{
      credential: TCredentialSummary;
    }>({
      method: 'POST',
      url: '/credentials',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        provider_id,
        name,
        collection_method: 'oauth',
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        access_token_expires_at: accessTokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        // These come from provider
        provider_display_name: provider.displayName,
        provider_icon: provider.icon,
      } as TJson,
    });

    return result.credential;
  }

  override async getCredential(
    credential_id: string
  ): Promise<TStoredCredential | null> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const result = await this.ganymedeClient.request<{
        credential: TStoredCredential;
      }>({
        method: 'GET',
        url: `/credentials/${credential_id}`,
      });
      return result.credential;
    } catch (error) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `Failed to get credential ${credential_id}`,
        error
      );
      return null;
    }
  }

  override async getCredentialSummary(
    credential_id: string
  ): Promise<TCredentialSummary | null> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const result = await this.ganymedeClient.request<{
        credential: TCredentialSummary;
      }>({
        method: 'GET',
        url: `/credentials/${credential_id}/summary`,
      });
      return result.credential;
    } catch (error) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `Failed to get credential summary ${credential_id}`,
        error
      );
      return null;
    }
  }

  override async listCredentials(
    user_id: string
  ): Promise<TCredentialSummary[]> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const result = await this.ganymedeClient.request<{
        credentials: TCredentialSummary[];
      }>({
        method: 'GET',
        url: '/credentials',
        queryParameters: { user_id },
      });
      return result.credentials;
    } catch (error) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `Failed to list credentials for user ${user_id}`,
        error
      );
      return [];
    }
  }

  override async updateCredential(
    credential_id: string,
    updates: {
      name?: string;
      metadata?: Record<string, unknown>;
      is_active?: boolean;
    }
  ): Promise<TCredentialSummary | null> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const result = await this.ganymedeClient.request<{
        credential: TCredentialSummary;
      }>({
        method: 'PATCH',
        url: `/credentials/${credential_id}`,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: updates as TJson,
      });
      return result.credential;
    } catch (error) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `Failed to update credential ${credential_id}`,
        error
      );
      return null;
    }
  }

  override async deleteCredential(credential_id: string): Promise<boolean> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      await this.ganymedeClient.request<{ success: boolean }>({
        method: 'DELETE',
        url: `/credentials/${credential_id}`,
      });
      return true;
    } catch (error) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `Failed to delete credential ${credential_id}`,
        error
      );
      return false;
    }
  }

  // ==========================================================================
  // CREDENTIAL USAGE (decryption happens here in gateway, not Ganymede)
  // ==========================================================================

  override async useCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null> {
    const credential = await this.getCredential(credential_id);
    if (!credential) {
      return null;
    }

    // Update last_used_at (fire and forget)
    this.ganymedeClient
      ?.request({
        method: 'POST',
        url: `/credentials/${credential_id}/use`,
      })
      .catch(() => {
        /* ignore */
      });

    try {
      if (credential.collection_method === 'api_key') {
        const apiKeyCred =
          credential as import('@holistix-forge/gateway').TStoredApiKeyCredential;
        const decryptedValues = JSON.parse(
          this.decrypt(apiKeyCred.encrypted_values)
        );
        return {
          id: credential.id,
          provider_id: credential.provider_id,
          collection_method: 'api_key',
          values: decryptedValues,
        };
      } else {
        const oauthCred =
          credential as import('@holistix-forge/gateway').TStoredOAuthCredential;
        const accessToken = this.decrypt(oauthCred.encrypted_access_token);
        const refreshToken = oauthCred.encrypted_refresh_token
          ? this.decrypt(oauthCred.encrypted_refresh_token)
          : undefined;
        return {
          id: credential.id,
          provider_id: credential.provider_id,
          collection_method: 'oauth',
          values: {
            access_token: accessToken,
            ...(refreshToken && { refresh_token: refreshToken }),
          },
        };
      }
    } catch (error) {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Failed to decrypt credential ${credential_id}`,
        error
      );
      return null;
    }
  }

  override async refreshOAuthCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null> {
    const credential = await this.getCredential(credential_id);
    if (!credential || credential.collection_method !== 'oauth') {
      return null;
    }

    const oauthCred =
      credential as import('@holistix-forge/gateway').TStoredOAuthCredential;
    if (!oauthCred.encrypted_refresh_token) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `No refresh token for credential ${credential_id}`
      );
      return null;
    }

    const provider = this.providerRegistry.get(credential.provider_id);
    if (!provider || provider.collectionMethod !== 'oauth') {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Provider ${credential.provider_id} not found or not OAuth`
      );
      return null;
    }

    // Get OAuth config
    const { oauth } = provider;
    const clientId = process.env[oauth.clientIdEnvVar];
    const clientSecret = process.env[oauth.clientSecretEnvVar];

    if (!clientId || !clientSecret) {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Missing OAuth credentials for provider ${credential.provider_id}`
      );
      return null;
    }

    try {
      const refreshToken = this.decrypt(oauthCred.encrypted_refresh_token);

      // Make token refresh request
      const response = await fetch(oauth.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();

      // Update stored credential with new tokens
      const encryptedAccessToken = this.encrypt(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? this.encrypt(tokens.refresh_token)
        : oauthCred.encrypted_refresh_token;

      const now = new Date();
      const accessTokenExpiresAt = tokens.expires_in
        ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
        : undefined;

      await this.ganymedeClient?.request({
        method: 'PATCH',
        url: `/credentials/${credential_id}`,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          access_token_expires_at: accessTokenExpiresAt,
        } as TJson,
      });

      return {
        id: credential.id,
        provider_id: credential.provider_id,
        collection_method: 'oauth',
        values: {
          access_token: tokens.access_token,
          ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        },
      };
    } catch (error) {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Failed to refresh OAuth credential ${credential_id}`,
        error
      );
      return null;
    }
  }

  // ==========================================================================
  // OAUTH FLOW STATE (in-memory, temporary)
  // ==========================================================================

  override saveOAuthState(state: TOAuthCredentialState): void {
    this.oauthStates.set(state.state, state);
    log(EPriority.Debug, 'CREDENTIALS', `Saved OAuth state: ${state.state}`);
  }

  override consumeOAuthState(state: string): TOAuthCredentialState | null {
    const stateData = this.oauthStates.get(state);
    if (stateData) {
      this.oauthStates.delete(state);
      log(EPriority.Debug, 'CREDENTIALS', `Consumed OAuth state: ${state}`);
    }
    return stateData || null;
  }

  override cleanupExpiredOAuthStates(): void {
    const now = new Date().toISOString();
    let cleaned = 0;

    for (const [state, stateData] of this.oauthStates.entries()) {
      if (stateData.expires_at < now) {
        this.oauthStates.delete(state);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log(
        EPriority.Info,
        'CREDENTIALS',
        `Cleaned up ${cleaned} expired OAuth states`
      );
    }
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  getStats(): { providers: number; pendingOAuthStates: number } {
    return {
      providers: this.providerRegistry.getAll().length,
      pendingOAuthStates: this.oauthStates.size,
    };
  }
}
