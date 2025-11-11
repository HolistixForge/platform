import { PermissionManager } from './PermissionManager';
import { gatewayState } from '../state';

/**
 * Singleton instance of PermissionManager
 * Uses gatewayState for persistence
 */
export const permissionManager = new PermissionManager(gatewayState);

// Re-export class and types
export { PermissionManager } from './PermissionManager';
