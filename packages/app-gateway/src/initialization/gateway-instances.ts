/**
 * Gateway Instances Registry - Service Locator Pattern
 *
 * This is the INTERNAL service registry for gateway infrastructure.
 * It stores all manager instances so gateway routes, middleware, and shutdown
 * logic can access them without tight coupling or circular dependencies.
 *
 * Who Uses This:
 * - Gateway routes (collab, permissions, OAuth, protected services)
 * - Gateway middleware (authentication, authorization)
 * - Gateway reducers (for project cleanup)
 * - Gateway shutdown logic
 *
 * This is SEPARATE from module config:
 * - Module config: Managers passed TO modules via load({ config })
 * - This registry: Managers accessed BY gateway internal code via getGatewayInstances()
 *
 * Example Usage:
 * ```typescript
 * // In a route handler
 * const instances = getGatewayInstances();
 * if (!instances) {
 *   return res.status(500).json({ error: 'Gateway not initialized' });
 * }
 * const hasPermission = instances.permissionManager.hasPermission(user_id, 'some:permission');
 * ```
 */
import type { GatewayInstances } from './gateway-init';
import type { ProjectRoomsManager } from '../state/ProjectRooms';

let gatewayInstances: GatewayInstances | null = null;

export function setGatewayInstances(instances: GatewayInstances): void {
  gatewayInstances = instances;
}

export function getGatewayInstances(): GatewayInstances | null {
  return gatewayInstances;
}

export function getProjectRoomsManager(): ProjectRoomsManager | null {
  return gatewayInstances?.projectRooms || null;
}

