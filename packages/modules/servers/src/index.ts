import { Servers_loadData } from './lib/servers-shared-model';
import { ServersReducer } from './lib/servers-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'servers',
    loadSharedData: Servers_loadData,
    loadReducers: (sd) => [new ServersReducer()],
    deps: [
      'gateway', // updateReverseProxy, gatewayFQDN, toGanymede, ...
    ],
  },
};

export type { TServersSharedData } from './lib/servers-shared-model';

export {
  projectServerNodeId,
  makeServer,
  makeVolume,
  makeMountEdge,
} from './lib/servers-reducer';

export type {
  TD_Server,
  TServer,
  TApi_Mount,
  TG_Server,
  TApi_Volume,
  TEc2InstanceState,
  TServerImageOptions,
  TD_ServerImage,
  TServerComponentProps,
  TServerComponentCallbacks,
} from './lib/servers-types';
export {
  TSSS_Server_to_TServerComponentProps,
  serviceUrl,
} from './lib/servers-types';

export type {
  TServerEvents,
  TEventMountVolume,
  TEventNewServer,
  TEventDeleteServer,
} from './lib/servers-events';
