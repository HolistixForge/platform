/**
 * Gateway State Data Structure
 *
 * This is pure data - no logic, no methods.
 * Used by GatewayState for persistence.
 */

// OAuth Client definition
export interface TOAuthClient {
  client_id: string;
  client_secret: string;
  container_id: string;
  project_id: string;
  service_name: string;
  redirect_uris: string[];
  grants: string[];
  created_at: string;
}

// OAuth Authorization Code
export interface TOAuthCode {
  code: string;
  client_id: string;
  user_id: string;
  scope: string[];
  redirect_uri: string;
  expires_at: string;
  created_at: string;
}

// OAuth Token
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

// Container HMAC Token
export interface TContainerToken {
  token: string;
  project_id: string;
  created_at: string;
}

/**
 * Complete gateway state data structure
 * Organization-scoped, persisted to /data/gateway-state-{org_id}.json
 */
export interface TGatewayStateData {
  organization_id: string;
  gateway_id: string;

  // Permissions: user_id → array of permission strings
  // Used by PermissionManager
  // Example: { "user-123": ["org:admin", "container:abc:delete"] }
  permissions: {
    [user_id: string]: string[];
  };

  // OAuth clients: client_id → client data
  // Used by OAuthManager
  oauth_clients: {
    [client_id: string]: TOAuthClient;
  };

  // OAuth authorization codes: code → code data
  // Used by OAuthManager
  oauth_authorization_codes: {
    [code: string]: TOAuthCode;
  };

  // OAuth tokens: token_id → token data
  // Used by OAuthManager
  oauth_tokens: {
    [token_id: string]: TOAuthToken;
  };

  // Container authentication tokens: container_id → token data
  // Used by ContainerTokenManager
  container_tokens: {
    [container_id: string]: TContainerToken;
  };

  // Metadata
  saved_at: string;
}
