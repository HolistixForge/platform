/**
 * Credential Provider Types
 *
 * Types for module-defined credential providers.
 * Modules register providers that define how to collect credentials
 * (API key fields or OAuth flow).
 */

// =============================================================================
// COLLECTION METHODS
// =============================================================================

/**
 * Collection method determines how credentials are gathered from users
 */
export type TCredentialCollectionMethod = 'api_key' | 'oauth';

// =============================================================================
// API KEY PROVIDER
// =============================================================================

/**
 * Field definition for API key credentials
 */
export type TApiKeyField = {
  /** Field identifier (e.g., 'api_key', 'token', 'secret') */
  name: string;
  /** Display label for the field */
  label: string;
  /** Input type - password for sensitive fields */
  type: 'text' | 'password';
  /** Placeholder text */
  placeholder?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Whether this field is required (default: true) */
  required?: boolean;
};

/**
 * API Key credential provider - user enters value(s) directly
 */
export type TApiKeyCredentialProvider = {
  /** Unique identifier for this provider */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this credential is for */
  description?: string;
  /** Icon identifier (icon name or URL) */
  icon?: string;
  /** Collection method */
  collectionMethod: 'api_key';
  /** Fields to collect from user */
  fields: TApiKeyField[];
  /** Optional endpoint to validate the credential after creation */
  validationEndpoint?: string;
};

// =============================================================================
// OAUTH PROVIDER
// =============================================================================

/**
 * OAuth configuration for credential providers
 */
export type TOAuthConfig = {
  /** OAuth authorization endpoint URL */
  authorizationUrl: string;
  /** OAuth token endpoint URL */
  tokenUrl: string;
  /** Environment variable name for client ID */
  clientIdEnvVar: string;
  /** Environment variable name for client secret */
  clientSecretEnvVar: string;
  /** Required OAuth scopes */
  scopes: string[];
  /** Use PKCE flow (recommended for public clients) */
  pkce?: boolean;
  /** Additional parameters for authorization URL */
  authorizationParams?: Record<string, string>;
  /** Additional parameters for token request */
  tokenParams?: Record<string, string>;
};

/**
 * OAuth credential provider - user goes through OAuth flow
 */
export type TOAuthCredentialProvider = {
  /** Unique identifier for this provider */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this credential is for */
  description?: string;
  /** Icon identifier (icon name or URL) */
  icon?: string;
  /** Collection method */
  collectionMethod: 'oauth';
  /** OAuth configuration */
  oauth: TOAuthConfig;
};

// =============================================================================
// UNION TYPE
// =============================================================================

/**
 * Credential provider - either API key or OAuth based
 */
export type TCredentialProvider =
  | TApiKeyCredentialProvider
  | TOAuthCredentialProvider;

// =============================================================================
// STORED CREDENTIAL TYPES
// =============================================================================

/**
 * Base stored credential (encrypted in database)
 */
export type TStoredCredentialBase = {
  /** Unique credential ID */
  id: string;
  /** User who owns this credential */
  user_id: string;
  /** Provider ID this credential was created with */
  provider_id: string;
  /** User-given name for this credential */
  name: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** When credential was created */
  created_at: string;
  /** When credential was last updated */
  updated_at: string;
  /** When credential was last used */
  last_used_at?: string;
  /** Whether credential is active */
  is_active: boolean;
};

/**
 * API Key stored credential
 */
export type TStoredApiKeyCredential = TStoredCredentialBase & {
  collection_method: 'api_key';
  /** Encrypted field values */
  encrypted_values: string;
};

/**
 * OAuth stored credential
 */
export type TStoredOAuthCredential = TStoredCredentialBase & {
  collection_method: 'oauth';
  /** Encrypted access token */
  encrypted_access_token: string;
  /** Encrypted refresh token (if available) */
  encrypted_refresh_token?: string;
  /** Access token expiration */
  access_token_expires_at?: string;
  /** Refresh token expiration */
  refresh_token_expires_at?: string;
  /** Scopes granted */
  scopes: string[];
};

/**
 * Stored credential (union)
 */
export type TStoredCredential =
  | TStoredApiKeyCredential
  | TStoredOAuthCredential;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Credential summary for list responses (no sensitive data)
 */
export type TCredentialSummary = {
  id: string;
  user_id: string;
  provider_id: string;
  name: string;
  collection_method: TCredentialCollectionMethod;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  is_active: boolean;
  // Provider info
  provider_display_name: string;
  provider_icon?: string;
};

/**
 * Decrypted credential values (for use, never sent to frontend)
 */
export type TDecryptedCredential = {
  id: string;
  provider_id: string;
  collection_method: TCredentialCollectionMethod;
  /** For api_key: object with field values. For oauth: access_token string */
  values:
    | Record<string, string>
    | { access_token: string; refresh_token?: string };
};
