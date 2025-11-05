import { ContainerTokenManager } from './ContainerTokenManager';
import { gatewayState } from '../state';

// Create singleton instance
export const containerTokenManager = new ContainerTokenManager(
  gatewayState,
  process.env.GATEWAY_HMAC_SECRET
);

// Re-export for convenience
export { ContainerTokenManager };

