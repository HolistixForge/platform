import './lib/index.scss';
import { NodeServer } from './lib/components/node-server/node-server';
import { NodeVolume } from './lib/components/node-volume/node-volume';
import type { TModule } from '@monorepo/module';
import type { TCollabFrontendExports } from '@monorepo/collab/frontend';
import type { TSpaceFrontendExports } from '@monorepo/space/frontend';
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

type TRequired = {
  collab: TCollabFrontendExports;
  space: TSpaceFrontendExports;
  authentication: TAuthenticationExtraContext;
};

export type TUserContainersFrontendExports = TServersExtraContext;

export const moduleFrontend: TModule<
  TRequired,
  TUserContainersFrontendExports
> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'space', 'authentication'],
  load: ({ depsExports, moduleExports }) => {
    depsExports.collab.collab.loadSharedData(
      'map',
      'user-containers',
      'containers'
    );
    depsExports.collab.collab.loadSharedData(
      'array',
      'user-containers',
      'images'
    );

    depsExports.space.registerMenuEntries(serversMenuEntries);
    depsExports.space.registerNodes({
      server: NodeServer,
      volume: NodeVolume,
    });

    moduleExports({
      servers: {
        getToken: (server, serviceName) => {
          const oauth_client = server.oauth.find(
            (o) => o.service_name === serviceName
          );
          if (!oauth_client) throw new Error('jupyterlab not mapped');
          return depsExports.authentication.authentication.getToken(
            oauth_client.client_id
          );
        },
      },
    });
  },
};
