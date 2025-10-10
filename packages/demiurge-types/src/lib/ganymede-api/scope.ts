export type TScope = {
  name: string;
  user: boolean;
  gateway: boolean;
};

const SCOPE: TScope[] = [
  { name: 'project:admin', user: true, gateway: false },
  { name: 'project:delete', user: true, gateway: false },
  { name: 'project:start', user: true, gateway: false },

  { name: 'project:get-gateway', user: false, gateway: false },
  { name: 'project:vpn-access', user: false, gateway: false },

  { name: 'user-container:create', user: true, gateway: false }, // declare a new user-container (just a record: name, image, etc)
  { name: 'user-container:host', user: true, gateway: false }, // run a user-container locally
  { name: 'user-container:cloud', user: true, gateway: false }, // run a user-container in demiurge cloud
  { name: 'user-container:start', user: true, gateway: false }, // only for user-containers in demiurge cloud, host users can obviously always start, stop and delete the user-container they manage
  { name: 'user-container:stop', user: true, gateway: true }, // idem
  { name: 'user-container:delete-cloud', user: true, gateway: false }, // delete a user-container instance in demiurge cloud
  { name: 'user-container:delete', user: true, gateway: false },

  { name: 'user-container:list', user: true, gateway: true },
  { name: 'user-container:share', user: false, gateway: false },
  { name: 'user-container:unshare', user: false, gateway: false },
  { name: 'user-container:status', user: true, gateway: true },
  { name: 'user-container:access', user: true, gateway: false },

  { name: 'mount:list', user: false, gateway: true },
  { name: 'mount:create', user: false, gateway: false },
  { name: 'mount:delete', user: false, gateway: false },

  { name: 'volume:list', user: false, gateway: true },
  { name: 'volume:create', user: false, gateway: false },
  { name: 'volume:delete', user: false, gateway: false },

  { name: 'scope:list', user: true, gateway: false },
  { name: 'scope:edit', user: true, gateway: false },

  { name: 'user-container:activity', user: false, gateway: true },
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

export const userContainerAccessScope = (client_id: string) =>
  `user-container:access:${client_id}`;

//

export const makeGatewayScopeString = (gateway_id: string, action?: string) =>
  `gateway:${gateway_id}${action ? `:${action}` : ''}`;

export const GLOBAL_CLIENT_ID = 'demiurge-global';
export const GLOBAL_CLIENT_SECRET = 'none';

// TODO_REMODULE: redo permission management, delete demiurge-types
