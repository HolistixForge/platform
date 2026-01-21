import { ApiFetch } from '@holistix-forge/api-fetch';
import type { GanymedeApi } from '../api-ganymede';
import { createGatewayFetch } from './gateway-fetch';
import { createCollabModuleConfig } from './collab-config';

/**
 * Helper to create module configs (collab + reducers)
 * 
 * This creates configuration objects for collab and reducers modules
 * without importing the actual module code, avoiding circular dependencies.
 * 
 * The actual modules are imported by app-frontend and passed to ModuleDataProvider.
 * 
 * @param organization_id - Organization ID (for future use)
 * @param gateway_hostname - Gateway hostname without protocol
 * @param ganymedeApi - API client for authentication
 * @returns Object with config factories
 */
export function createModuleConfigs({
  organization_id,
  gateway_hostname,
  ganymedeApi,
  userInfo,
}: {
  organization_id: string;
  gateway_hostname: string;
  ganymedeApi: GanymedeApi;
  userInfo: { user_id: string; username: string };
}) {
  
  // Create gateway fetch for reducers and other modules
  const gatewayFetch: ApiFetch = createGatewayFetch(ganymedeApi, gateway_hostname);
  
  // Create collab module config with multi-project support
  const collabConfig = createCollabModuleConfig({
    gateway_hostname,
    ganymedeApi,
    userInfo,
  });
  
  return {
    gatewayFetch,
    collabConfig,
  };
}
