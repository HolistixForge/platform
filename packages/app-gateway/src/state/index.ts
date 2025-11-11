import { GatewayState, setupShutdownHandlers } from './GatewayState';

/**
 * Singleton instance of GatewayState
 * Used by all managers (PermissionManager, OAuthManager, etc.)
 */
export const gatewayState = new GatewayState();

// Setup shutdown handlers for graceful shutdown
setupShutdownHandlers(gatewayState);

// Re-export types and classes
export { GatewayState, setupShutdownHandlers } from './GatewayState';
export { ProjectRoomsManager } from './ProjectRooms';
export type { ProjectRoomData } from './ProjectRooms';
export { ProjectPersistence } from './ProjectPersistence';
export type {
  TGatewayStateData,
  TOAuthClient,
  TOAuthCode,
  TOAuthToken,
  TContainerToken,
} from './types';
