import './lib/index.scss';
import { Servers_loadData } from './lib/servers-shared-model';
import { NodeServer } from './lib/components/node-server/node-server';
import { NodeVolume } from './lib/components/node-volume/node-volume';
import { ModuleFrontend } from '@monorepo/module/frontend';
import { TServer } from './lib/servers-types';
import { serversMenuEntries } from './lib/servers-menu';

export { StatusLed } from './lib/components/status-led';
export { NewServerForm } from './lib/form/new-server';
export { ServerCard, ServerCardInternal } from './lib/components/server-card';
export { awsInstanceTypes } from './lib/form/cloud-instance-options';

//

export type TServersExtraContext = {
  servers: {
    getToken: (s: TServer, serviceName: string) => Promise<string>;
  };
};

export type TAuthenticationExtraContext = {
  authentication: {
    getToken: (clientId: string) => Promise<string>;
  };
};

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'user-containers',
    loadSharedData: Servers_loadData,
    loadExtraContext: ({ extraContext }): TServersExtraContext => ({
      servers: {
        getToken: (server, serviceName) => {
          const oauth_client = server.oauth.find(
            (o) => o.service_name === serviceName
          );
          if (!oauth_client) throw new Error('jupyterlab not mapped');
          return (
            extraContext as TAuthenticationExtraContext
          ).authentication.getToken(oauth_client.client_id);
        },
      },
    }),
    deps: ['authentication'],
  },
  spaceMenuEntries: serversMenuEntries,
  nodes: {
    server: NodeServer,
    volume: NodeVolume,
  },
};
