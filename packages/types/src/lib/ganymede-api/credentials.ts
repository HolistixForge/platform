/**
 * Credentials Wallet Types
 *
 * Types for the credentials wallet feature that allows users to manage
 * third-party API keys and credentials securely.
 */

/**
 * Credential type metadata - defines available credential types (registered by modules)
 */
export type TCredentialType = {
  credential_type: string;
  display_name: string;
  description: string | null;
  icon_url: string | null;
  validation_schema: Record<string, unknown> | null;
  required_fields: string[];
  module_name: string;
};

/**
 * Credential summary - returned in list responses (no decrypted value)
 */
export type TCredentialSummary = {
  credential_id: string;
  user_id: string;
  credential_type: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  is_shared?: boolean;
  share_scope?: string | null;
};

/**
 * Credential detail - includes decrypted value (for API calls)
 */
export type TCredentialDetail = TCredentialSummary & {
  value: string;
};

/**
 * Credential share - tracks who has access to a shared credential
 */
export type TCredentialShare = {
  share_id: string;
  credential_id: string;
  share_scope: 'organization' | 'project' | 'resource';
  organization_id: string | null;
  project_id: string | null;
  resource_id: string | null;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
};

/**
 * Request body for creating a credential
 */
export type TCreateCredentialRequest = {
  credential_type: string;
  name: string;
  value: string;
  metadata?: Record<string, unknown>;
};

/**
 * Request body for updating a credential
 */
export type TUpdateCredentialRequest = {
  name?: string;
  value?: string;
  metadata?: Record<string, unknown>;
  is_active?: boolean;
};

/**
 * Request body for sharing a credential
 */
export type TShareCredentialRequest = {
  share_scope: 'organization' | 'project' | 'resource';
  organization_id?: string;
  project_id?: string;
  resource_id?: string;
};

/**
 * Credential provider definition - used by modules to define their credential types
 */
export type TCredentialProvider = {
  credentialTypeId: string;
  displayName: string;
  description: string;
  icon: string;
  collectionMethod: 'api_key' | 'oauth';
  validationSchema?: Record<string, unknown>;
  oauthConfig?: {
    authorizationUrl: string;
    tokenUrl: string;
    clientId: string;
    scopes: string[];
  };
};
