/**
 * Credential Provider Registry
 *
 * Allows modules to register their credential providers during module loading.
 * Providers define how credentials are collected (API key fields or OAuth flow).
 *
 * This is similar to PermissionRegistry - it's a compile-time registry that
 * modules populate during initialization.
 */

import type { TCredentialProvider } from './credential-provider-types';

export class CredentialProviderRegistry {
  private providers: Map<string, TCredentialProvider> = new Map();

  /**
   * Register a credential provider
   *
   * @param provider - Provider definition
   * @throws Error if provider ID is already registered
   */
  register(provider: TCredentialProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(
        `Credential provider '${provider.id}' is already registered`
      );
    }

    // Validate provider
    this.validateProvider(provider);

    this.providers.set(provider.id, provider);
  }

  /**
   * Get provider by ID
   */
  get(id: string): TCredentialProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  getAll(): TCredentialProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by collection method
   */
  getByCollectionMethod(method: 'api_key' | 'oauth'): TCredentialProvider[] {
    return this.getAll().filter((p) => p.collectionMethod === method);
  }

  /**
   * Check if provider exists
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Validate provider definition
   */
  private validateProvider(provider: TCredentialProvider): void {
    // Validate ID format (lowercase, alphanumeric, underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(provider.id)) {
      throw new Error(
        `Invalid provider ID '${provider.id}': must be lowercase alphanumeric with underscores, starting with letter`
      );
    }

    // Validate display name
    if (!provider.displayName || provider.displayName.trim().length === 0) {
      throw new Error(`Provider '${provider.id}' must have a displayName`);
    }

    // Validate collection method specific fields
    if (provider.collectionMethod === 'api_key') {
      if (!provider.fields || provider.fields.length === 0) {
        throw new Error(
          `API key provider '${provider.id}' must have at least one field`
        );
      }
      // Validate each field
      provider.fields.forEach((field, index) => {
        if (!field.name || !field.label) {
          throw new Error(
            `Field ${index} in provider '${provider.id}' must have name and label`
          );
        }
        if (!['text', 'password'].includes(field.type)) {
          throw new Error(
            `Field '${field.name}' in provider '${provider.id}' has invalid type '${field.type}'`
          );
        }
      });
    } else if (provider.collectionMethod === 'oauth') {
      if (!provider.oauth) {
        throw new Error(
          `OAuth provider '${provider.id}' must have oauth configuration`
        );
      }
      const { oauth } = provider;
      if (!oauth.authorizationUrl || !oauth.tokenUrl) {
        throw new Error(
          `OAuth provider '${provider.id}' must have authorizationUrl and tokenUrl`
        );
      }
      if (!oauth.clientIdEnvVar || !oauth.clientSecretEnvVar) {
        throw new Error(
          `OAuth provider '${provider.id}' must specify clientIdEnvVar and clientSecretEnvVar`
        );
      }
    }
  }
}
