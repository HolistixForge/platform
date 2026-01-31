import { ApiFetch } from '@holistix-forge/api-fetch';
import { GanymedeApi } from '../api-ganymede';
import { TMyfetchRequest } from '@holistix-forge/simple-types';

/**
 * Create an ApiFetch instance that routes to gateway
 * 
 * This creates a fetch wrapper that:
 * - Routes requests to the gateway hostname
 * - Reuses GanymedeApi's token management (OAuth, refresh, etc.)
 * - Maintains consistent error handling
 * 
 * @param ganymedeApi - API client with token management
 * @param gateway_hostname - Gateway hostname (without protocol)
 * @returns ApiFetch instance configured for gateway
 */
export const createGatewayFetch = (
  ganymedeApi: GanymedeApi,
  gateway_hostname: string
): ApiFetch => {
  class GatewayFetch extends ApiFetch {
    override async fetch(r: TMyfetchRequest): Promise<any> {
      const gatewayUrl = `https://${gateway_hostname}`;
      return ganymedeApi.fetch(r, gatewayUrl);
    }
  }

  return new GatewayFetch();
};
