/**
 * URL and identifier construction helpers
 *
 * Centralized functions to build URLs and identifiers consistently.
 * Prevents inconsistencies from inline string concatenation.
 */

/**
 * Get the configured domain
 */
function getDomain(): string {
  return process.env.DOMAIN || 'domain.local';
}

/**
 * Construct organization gateway hostname
 * @param organizationId - Organization UUID
 * @returns org-{uuid}.domain.local
 */
export function makeOrgGatewayHostname(organizationId: string): string {
  return `org-${organizationId}.${getDomain()}`;
}

/**
 * Construct organization gateway URL
 * @param organizationId - Organization UUID
 * @returns https://org-{uuid}.domain.local
 */
export function makeOrgGatewayUrl(organizationId: string): string {
  return `https://${makeOrgGatewayHostname(organizationId)}`;
}

/**
 * Construct Ganymede API URL
 * @returns https://ganymede.domain.local
 */
export function makeGanymedeUrl(): string {
  return `https://ganymede.${getDomain()}`;
}

/**
 * Construct frontend URL
 * @returns https://domain.local
 */
export function makeFrontendUrl(): string {
  return `https://${getDomain()}`;
}
