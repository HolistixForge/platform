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

      // Accept all 2xx status codes as successful responses
      // 2xx range includes: 200 OK, 201 Created, 204 No Content, 206 Partial Content, etc.
      if (response.statusCode < 200 || response.statusCode >= 300) {
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
 * The base URL for the handful of calls that use `fetch` directly.
 *
 * Four of them do — project members, organization members, and the two project
 * role writes — and each read `GANYMEDE_URL`, which nothing sets. Neither pool
 * script exports it and neither Ansible role writes it, so every one of those
 * calls has been going to `http://app-ganymede:3000`, a compose hostname that
 * resolves in no deployment this repository builds. The permission
 * initialization that follows catches the failure and logs it, and the project
 * still reports itself fully initialized — so a room comes up with nobody
 * authorised in it and nothing above the log says why.
 *
 * `GANYMEDE_URL` still wins when it is set, so an operator who has been working
 * around this keeps their override. Otherwise the FQDN, which is the one
 * address a gateway can always reach Ganymede at: on Linux CoreDNS resolves it,
 * on macOS the entrypoint writes it into /etc/hosts from the default route, and
 * nginx picks the right server block from the name without a Host header.
 */
export function ganymedeBaseUrl(): string {
  if (process.env.GANYMEDE_URL) return process.env.GANYMEDE_URL;
  const fqdn = process.env.GANYMEDE_FQDN || CONFIG.GANYMEDE_FQDN;
  if (fqdn) return `https://${fqdn}`;
  return 'http://app-ganymede:3000';
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
    process.env.GANYMEDE_API_URL || `https://${CONFIG.GANYMEDE_FQDN}`;

  return new GanymedeClient({
    ganymedeApiUrl,
    ganymedeFQDN: CONFIG.GANYMEDE_FQDN,
    gatewayToken: gatewayToken || CONFIG.GATEWAY_TOKEN,
    organizationToken,
  });
}
