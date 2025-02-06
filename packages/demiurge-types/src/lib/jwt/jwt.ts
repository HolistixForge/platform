export type TJwtServer = {
  type: 'server_token';
  project_id: string;
  project_server_id: string;
  scope: string;
};

export type TJwtProject = {
  type: 'project_token';
  project_id: string;
  scope: string;
};

export type TJwtGateway = {
  type: 'gateway_token';
  gateway_id: string;
  scope: string;
};

export type TJwtUser = {
  type: 'access_token' | 'refresh_token';
  client_id: string;
  user: { id: string; username: string };
  scope: string[];
};
