/**
 * Container Token Manager Data Types
 *
 * Container token data stored in GatewayState.
 */

// Container HMAC Token
export interface TContainerToken {
  token: string;
  project_id: string;
  created_at: string;
}

/**
 * Container tokens slice of gateway state
 */
export interface TContainerTokenData {
  container_tokens: {
    [container_id: string]: TContainerToken;
  };
}

