/**
 * CredentialManager - Manages credentials for third-party integrations
 *
 * Responsibilities:
 * - Manages the CredentialProviderRegistry (modules register providers here)
 * - Proxies credential CRUD operations to Ganymede API
 * - Handles OAuth flow state (temporary in-memory)
 *
 * NOTE: Encryption is handled by Ganymede, NOT here.
 * Gateway sends plaintext to Ganymede, which encrypts before storage.
 */

import { EPriority, log } from '@holistix-forge/log';
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
 * Credential Manager Implementation
 *
 * Acts as a proxy to Ganymede's credential API.
 * Encryption/decryption happens in Ganymede, not here.
 */
export class CredentialManagerImpl extends AbstractCredentialManager {
  private providerRegistry: CredentialProviderRegistry;
  private oauthStates: Map<string, TOAuthCredentialState> = new Map();
  private ganymedeClient: GanymedeClient | null = null;

  constructor() {
    super();
    this.providerRegistry = new CredentialProviderRegistry();
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
  // CREDENTIAL STORAGE (via Ganymede API - Ganymede handles encryption)
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

    log(
      EPriority.Info,
      'CREDENTIALS',
      `Creating API key credential for provider ${request.provider_id}`
    );

    // Call Ganymede API - send plaintext, Ganymede encrypts
    const result = await this.ganymedeClient.request<{
      credential: TCredentialSummary;
    }>({
      method: 'POST',
      url: '/credentials',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        type: request.provider_id,
        name: request.name,
        // Send as JSON string - Ganymede will encrypt this
        value: JSON.stringify(request.values),
        metadata: request.metadata,
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

    log(
      EPriority.Info,
      'CREDENTIALS',
      `Creating OAuth credential for provider ${provider_id}`
    );

    // Calculate expiration times
    const now = new Date();
    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : undefined;

    // Call Ganymede API - send plaintext, Ganymede encrypts
    const result = await this.ganymedeClient.request<{
      credential: TCredentialSummary;
    }>({
      method: 'POST',
      url: '/credentials',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        type: provider_id,
        name,
        // Send tokens as JSON - Ganymede will encrypt this
        value: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
        }),
        metadata: {
          collection_method: 'oauth',
          access_token_expires_at: accessTokenExpiresAt,
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
        },
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
    // For summary, we just get the credential without the decrypted value
    const credential = await this.getCredential(credential_id);
    if (!credential) return null;

    // Return summary (without value)
    return {
      id: credential.id,
      user_id: credential.user_id,
      provider_id: credential.provider_id,
      name: credential.name,
      collection_method: credential.collection_method,
      metadata: credential.metadata,
      created_at: credential.created_at,
      updated_at: credential.updated_at,
      last_used_at: credential.last_used_at,
      is_active: credential.is_active,
      provider_display_name: '',
      provider_icon: undefined,
    };
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
        queryParameters: { include_shared: 'false' },
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
  // CREDENTIAL USAGE (decrypted value from Ganymede)
  // ==========================================================================

  override async useCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null> {
    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      // Call Ganymede's decrypt endpoint
      const result = await this.ganymedeClient.request<{
        credential: { id: string; type: string; value: string };
      }>({
        method: 'GET',
        url: `/credentials/${credential_id}/value`,
      });

      const provider = this.providerRegistry.get(result.credential.type);
      const collectionMethod = provider?.collectionMethod || 'api_key';

      // Parse the decrypted value
      const values = JSON.parse(result.credential.value);

      return {
        id: result.credential.id,
        provider_id: result.credential.type,
        collection_method: collectionMethod,
        values,
      };
    } catch (error) {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Failed to get credential ${credential_id}`,
        error
      );
      return null;
    }
  }

  override async refreshOAuthCredential(
    credential_id: string
  ): Promise<TDecryptedCredential | null> {
    // Get current credential
    const decrypted = await this.useCredential(credential_id);
    if (!decrypted || decrypted.collection_method !== 'oauth') {
      return null;
    }

    const values = decrypted.values as {
      access_token: string;
      refresh_token?: string;
    };
    if (!values.refresh_token) {
      log(
        EPriority.Warning,
        'CREDENTIALS',
        `No refresh token for credential ${credential_id}`
      );
      return null;
    }

    const provider = this.providerRegistry.get(decrypted.provider_id);
    if (!provider || provider.collectionMethod !== 'oauth') {
      log(
        EPriority.Error,
        'CREDENTIALS',
        `Provider ${decrypted.provider_id} not found or not OAuth`
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
        `Missing OAuth credentials for provider ${decrypted.provider_id}`
      );
      return null;
    }

    try {
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
          refresh_token: values.refresh_token,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();

      // Update stored credential with new tokens via Ganymede
      await this.ganymedeClient?.request({
        method: 'PATCH',
        url: `/credentials/${credential_id}`,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          value: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || values.refresh_token,
            scope: tokens.scope,
          }),
        } as TJson,
      });

      return {
        id: credential_id,
        provider_id: decrypted.provider_id,
        collection_method: 'oauth',
        values: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || values.refresh_token,
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
