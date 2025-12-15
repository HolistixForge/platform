/**
 * Centralized Ganymede API Client
 *
 * Handles URL construction and networking for all Ganymede API calls.
 * Uses GANYMEDE_API_URL (full URL) and GANYMEDE_FQDN (for Host header).
 * Always adds Host header to bypass DNS resolution issues in gateway containers.
 */

import { EPriority, log } from '@holistix-forge/log';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import { myfetch } from '@holistix-forge/backend-engine';
import { CONFIG } from '../config';

/**
 * Ganymede API Client Configuration
 */
export interface GanymedeClientConfig {
  ganymedeApiUrl: string; // Full API URL (e.g., 'https://172.17.0.2' or 'https://ganymede.domain.local')
  ganymedeFQDN: string; // FQDN for Host header (e.g., 'ganymede.domain.local')
  gatewayToken?: string; // Gateway-level token (TJwtGateway) - for /gateway/ready
  organizationToken?: string; // Organization-level token (TJwtOrganization) - for data operations, DNS
}

/**
 * Centralized Ganymede API Client
 *
 * Provides a single function to make requests to Ganymede API.
 * Handles URL construction, authentication, and container networking automatically.
 */
export class GanymedeClient {
  private ganymedeApiUrl: string;
  private ganymedeFQDN: string;
  private gatewayToken?: string;
  private organizationToken?: string;

  constructor(config: GanymedeClientConfig) {
    this.ganymedeApiUrl = config.ganymedeApiUrl;
    this.ganymedeFQDN = config.ganymedeFQDN;
    this.gatewayToken = config.gatewayToken;
    this.organizationToken = config.organizationToken;

    log(
      EPriority.Info,
      'GANYMEDE_CLIENT',
      `Initialized Ganymede client: ${this.ganymedeApiUrl} (Host: ${this.ganymedeFQDN})`
    );
  }

  /**
   * Update organization token (called after /collab/start)
   */
  setOrganizationToken(token: string): void {
    this.organizationToken = token;
  }

  /**
   * Make a request to Ganymede API
   *
   * @param request - Request object (url should be relative path, e.g., '/gateway/config')
   * @param tokenOverride - Optional token to use instead of default (for gateway vs organization tokens)
   * @returns Response JSON
   */
  async request<T>(
    request: TMyfetchRequest,
    tokenOverride?: string
  ): Promise<T> {
    // Ensure headers object exists
    if (!request.headers) {
      request.headers = {};
    }

    // Add authorization header if token is available and not already provided
    // Ganymede API expects "Bearer " prefix for JWT tokens
    if (!request.headers.authorization) {
      // Use override token if provided, otherwise use organizationToken, fallback to gatewayToken
      const tokenToUse =
        tokenOverride || this.organizationToken || this.gatewayToken;
      if (tokenToUse) {
        request.headers.authorization = `Bearer ${tokenToUse}`;
      }
    }

    // Always add Host header to bypass DNS resolution issues in gateway containers
    request.headers['Host'] = this.ganymedeFQDN;

    // Build full URL
    const fullUrl = `${this.ganymedeApiUrl}${request.url}`;
    request.url = fullUrl;

    log(
      EPriority.Info,
      'GANYMEDE_CLIENT',
      `Request: ${request.method || 'GET'} ${fullUrl}`
    );

    try {
      const response = await myfetch(request);

      log(
        EPriority.Info,
        'GANYMEDE_CLIENT',
        `${fullUrl} response: ${response.statusCode}`
      );

      if (response.statusCode !== 200) {
        const error = new Error(
          `Request to ${fullUrl} failed with status ${response.statusCode}`
        );
        throw error;
      }

      return response.json as T;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log(
        EPriority.Error,
        'GANYMEDE_CLIENT',
        `Request to ${fullUrl} failed:`,
        errorMessage
      );
      throw error;
    }
  }

  /**
   * Get the base URL (for logging/debugging)
   */
  getBaseUrl(): string {
    return this.ganymedeApiUrl;
  }
}

/**
 * Create a Ganymede client instance
 * Uses GANYMEDE_API_URL and GANYMEDE_FQDN from environment
 *
 * @param organizationToken - Organization token (for data operations, DNS)
 * @param gatewayToken - Gateway token (for /gateway/ready) - defaults to CONFIG.GATEWAY_TOKEN
 */
export function createGanymedeClient(
  organizationToken?: string,
  gatewayToken?: string
): GanymedeClient {
  // GANYMEDE_API_URL should be set in environment (e.g., 'https://172.17.0.2' or 'https://ganymede.domain.local')
  // If not set, fallback to constructing from GANYMEDE_FQDN
  const ganymedeApiUrl =
    process.env.GANYMEDE_API_URL ||
    `https://${CONFIG.GANYMEDE_FQDN}`;

  return new GanymedeClient({
    ganymedeApiUrl,
    ganymedeFQDN: CONFIG.GANYMEDE_FQDN,
    gatewayToken: gatewayToken || CONFIG.GATEWAY_TOKEN,
    organizationToken,
  });
}
