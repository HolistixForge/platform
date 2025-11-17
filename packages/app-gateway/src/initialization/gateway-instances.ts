/**
 * Gateway Instances Registry
 *
 * Stores gateway instances so routes and other modules can access them.
 */
import type { GatewayInstances } from './gateway-init';

let gatewayInstances: GatewayInstances | null = null;

export function setGatewayInstances(instances: GatewayInstances): void {
  gatewayInstances = instances;
}

export function getGatewayInstances(): GatewayInstances | null {
  return gatewayInstances;
}

