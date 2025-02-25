export type TScope = {
  name: string;
  user: boolean;
  gateway: boolean;
};

const SCOPE: TScope[] = [
  { name: 'project:delete', user: true, gateway: false },
  { name: 'project:start', user: true, gateway: false },

  { name: 'project:get-gateway', user: false, gateway: false },
  { name: 'project:vpn-access', user: false, gateway: false },

  { name: 'server:create', user: true, gateway: false }, // declare a new server (just a record: name, image, etc)
  { name: 'server:host', user: true, gateway: false }, // run a server locally
  { name: 'server:cloud', user: true, gateway: false }, // run a server in demiurge cloud
  { name: 'server:start', user: true, gateway: false }, // only for servers in demiurge cloud, host users can obviously always start, stop and delete the server they manage
  { name: 'server:stop', user: true, gateway: true }, // idem
  { name: 'server:delete-cloud', user: true, gateway: false }, // delete a server instance in demiurge cloud
  { name: 'server:delete', user: true, gateway: false },

  { name: 'server:list', user: true, gateway: true },
  { name: 'server:share', user: false, gateway: false },
  { name: 'server:unshare', user: false, gateway: false },
  { name: 'server:status', user: true, gateway: true },
  { name: 'server:access', user: true, gateway: false },

  { name: 'mount:list', user: false, gateway: true },
  { name: 'mount:create', user: false, gateway: false },
  { name: 'mount:delete', user: false, gateway: false },

  { name: 'volume:list', user: false, gateway: true },
  { name: 'volume:create', user: false, gateway: false },
  { name: 'volume:delete', user: false, gateway: false },

  { name: 'scope:list', user: true, gateway: false },
  { name: 'scope:edit', user: true, gateway: false },

  { name: 'server:activity', user: false, gateway: true },
] as const;

export const USER_SCOPE = SCOPE.filter((s) => s.user).map((s) => s.name);

export const GATEWAY_PROJECT_SCOPE = SCOPE.filter((s) => s.gateway).map(
  (s) => s.name
);

export const GATEWAY_SCOPE = [{ name: 'ready' }, { name: 'stop' }];

//

export const makeProjectScopeString = (project_id: string, action?: string) =>
  `p:${project_id}${action ? `:${action}` : ''}`;

//

export const serverAccessScope = (client_id: string) =>
  `server:access:${client_id}`;

//

export const makeGatewayScopeString = (gateway_id: string, action?: string) =>
  `gateway:${gateway_id}${action ? `:${action}` : ''}`;

export const GLOBAL_CLIENT_ID = 'demiurge-global';
export const GLOBAL_CLIENT_SECRET = 'none';
