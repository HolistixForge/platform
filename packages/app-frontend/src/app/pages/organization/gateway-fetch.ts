import { ApiFetch } from '@monorepo/api-fetch';
import { GanymedeApi } from '@monorepo/frontend-data';
import { TMyfetchRequest } from '@monorepo/simple-types';

/**
 * Create an ApiFetch instance that routes to gateway
 * Reuses GanymedeApi's token management
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

