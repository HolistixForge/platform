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
 * token given to a runner when a machine is enrolled
 *
 * Not a user token on a laptop: it names one machine, carries no organization
 * and no project, and is withdrawn by revoking the runner row rather than by
 * signing its owner out of everywhere.
 */
export type TJwtRunner = {
  type: 'runner_token';
  runner_id: string;
  user_id: string;
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
