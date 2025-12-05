/**
 * Permission Manager Data Types
 *
 * Permission data stored in GatewayState.
 */

/**
 * Permissions slice of gateway state
 * Maps user_id → array of permission strings
 * Example: { "user-123": ["org:admin", "container:abc:delete"] }
 */
export interface TPermissionData {
  permissions: {
    [user_id: string]: string[];
  };
}

