/**
 * OAuth Manager Data Types
 *
 * OAuth data stored in GatewayState.
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

/**
 * OAuth slice of gateway state
 */
export interface TOAuthData {
  oauth_clients: {
    [client_id: string]: TOAuthClient;
  };
  oauth_authorization_codes: {
    [code: string]: TOAuthCode;
  };
  oauth_tokens: {
    [token_id: string]: TOAuthToken;
  };
}

