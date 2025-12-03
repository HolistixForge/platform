/**
 * token given to gateway when bound to a organization
 * Includes gateway_id to track which gateway is serving the org
 */
export type TJwtOrganization = {
  type: 'organization_token';
  organization_id: string;
  gateway_id: string;
  scope: string;
};

/**
 * token given to gateway container when started
 */
export type TJwtGateway = {
  type: 'gateway_token';
  gateway_id: string;
  scope: string;
};

/**
 * token given to (human) users
 */
export type TJwtUser = {
  type: 'access_token' | 'refresh_token';
  client_id: string;
  user: { id: string; username: string };
  scope: string[];
  grants?: string[];
};
