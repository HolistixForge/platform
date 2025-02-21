/**
 * token given to users's project server container
 */
export type TJwtServer = {
  type: 'server_token';
  project_id: string;
  project_server_id: string;
  scope: string;
};

/**
 * token given to gateway when bound to a project
 */
export type TJwtProject = {
  type: 'project_token';
  project_id: string;
  scope: string;
};

/**
 * token given to gateway when in stand by
 */
export type TJwtGateway = {
  type: 'gateway_token';
  gateway_id: string;
  scope: string;
};

/**
 * token givent to users
 */
export type TJwtUser = {
  type: 'access_token' | 'refresh_token';
  client_id: string;
  user: { id: string; username: string };
  scope: string[];
};
